/**
 * contextService.js
 * Builds the 4-layer context hierarchy for AI agent decision-making.
 * Uses Redis caching to prevent computational overload on repeated queries.
 *
 * Layers:
 *   1. Immediate    – current invoice details, supplier name, date
 *   2. Historical   – fresh ranked memories (< 12 months)
 *   3. Temporal     – stale memories with decay weights + seasonal flags
 *   4. Experiential – aggregate learnings: total losses, trend, avg severity
 */

const { getMemoriesForSupplier } = require("./memoryService")
const { getDetailedRisk } = require("./riskService")
const { redisClient } = require("../config/redis")
const prisma = require("../config/prisma")

const CACHE_TTL = 300 // 5 minutes in seconds

/**
 * Detect seasonal pattern based on event dates
 */
function detectSeasonalPattern(events) {
    const summerMonths = [2, 3, 4] // March, April, May (0-indexed)
    const monsoonMonths = [5, 6, 7, 8] // June–September

    const summerEvents = events.filter((e) => {
        const month = new Date(e.createdAt).getMonth()
        return summerMonths.includes(month)
    })
    const monsoonEvents = events.filter((e) => {
        const month = new Date(e.createdAt).getMonth()
        return monsoonMonths.includes(month)
    })

    const patterns = []
    if (summerEvents.length >= 2) {
        patterns.push("⚠ Elevated quality issues during summer months (Mar–May). Heat-sensitive packaging risk.")
    }
    if (monsoonEvents.length >= 2) {
        patterns.push("⚠ Delivery delays logged during monsoon season (Jun–Sep). Logistics vulnerability detected.")
    }
    return patterns
}

/**
 * Calculate improvement or deterioration trend.
 * Compares avg severity of recent 3 events vs older events.
 */
function calculateTrend(rankedEvents) {
    if (rankedEvents.length < 4) return { direction: "insufficient_data", delta: 0 }
    const recent = rankedEvents.slice(0, Math.ceil(rankedEvents.length / 2))
    const older = rankedEvents.slice(Math.ceil(rankedEvents.length / 2))
    const recentAvg = recent.reduce((s, e) => s + e.severity, 0) / recent.length
    const olderAvg = older.reduce((s, e) => s + e.severity, 0) / older.length
    const delta = parseFloat((olderAvg - recentAvg).toFixed(3))
    return {
        direction: delta > 0.05 ? "improving" : delta < -0.05 ? "deteriorating" : "stable",
        delta,
    }
}

/**
 * Build comprehensive layered context for a supplier.
 * @param {number} supplierId
 * @param {object} immediateData – { invoiceAmount, invoiceId? }
 */
async function buildContext(supplierId, immediateData = {}) {
    const id = parseInt(supplierId)
    const cacheKey = `context:supplier:${id}`

    // Check Redis cache (prevents repeated heavy DB queries)
    try {
        const cached = await redisClient.get(cacheKey)
        if (cached) {
            console.log(`[ContextService] Cache HIT for supplier ${id}`)
            const parsed = JSON.parse(cached)
            // Overlay fresh immediate context
            if (immediateData.invoiceAmount) {
                parsed.immediateContext.invoiceAmount = immediateData.invoiceAmount
            }
            parsed.cacheHit = true
            return parsed
        }
        console.log(`[ContextService] Cache MISS for supplier ${id}`)
    } catch (err) {
        console.warn("[ContextService] Redis unavailable, proceeding without cache:", err.message)
    }

    // Fetch supplier
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new Error("Supplier not found")

    // Fetch memories and risk
    const [memories, riskData] = await Promise.all([
        getMemoriesForSupplier(id),
        getDetailedRisk(id),
    ])

    const trend = calculateTrend(memories.ranked)
    const seasonalPatterns = detectSeasonalPattern(memories.ranked)

    // ── Layer 1: Immediate Context ──────────────────────────────────────────
    const immediateContext = {
        supplierId: id,
        supplierName: supplier.name,
        invoiceAmount: immediateData.invoiceAmount || null,
        processingDate: new Date().toISOString(),
        currentRiskScore: parseFloat(riskData.riskScore.toFixed(3)),
    }

    // ── Layer 2: Historical Context (fresh memories, < 12 months) ───────────
    const historicalContext = {
        freshEventCount: memories.fresh.length,
        topMemories: memories.fresh.slice(0, 5).map((e) => ({
            id: e.id,
            type: e.type,
            severity: e.severity,
            impactCost: e.impactCost,
            description: e.description,
            relevanceScore: e.relevanceScore,
            ageMonths: e.ageMonths,
            memoryStatus: e.memoryStatus,
            memoryTag: e.memoryTag,
        })),
        summary: memories.summary,
    }

    // ── Layer 3: Temporal Context (stale events + seasonal) ─────────────────
    const temporalContext = {
        staleEventCount: memories.stale.length,
        archivedEventCount: memories.archived.length,
        staleEvents: memories.stale.slice(0, 3).map((e) => ({
            id: e.id,
            type: e.type,
            severity: e.severity,
            impactCost: e.impactCost,
            decayFactor: e.decayFactor,
            ageMonths: e.ageMonths,
            memoryStatus: e.memoryStatus,
            note: "Downweighted due to age — may reflect resolved issues",
        })),
        seasonalPatterns,
        stalenessNote:
            memories.stale.length > 0
                ? `${memories.stale.length} event(s) are stale (12–24 months old) and have reduced influence on risk.`
                : "No stale events detected.",
    }

    // ── Layer 4: Experiential Context (aggregate learnings) ─────────────────
    const totalLoss = memories.ranked.reduce((s, e) => s + e.impactCost, 0)
    const avgSeverity =
        memories.ranked.length > 0
            ? memories.ranked.reduce((s, e) => s + e.severity, 0) / memories.ranked.length
            : 0

    const experientialContext = {
        totalDocumentedLoss: totalLoss,
        averageSeverity: parseFloat(avgSeverity.toFixed(3)),
        eventTypeBreakdown: memories.ranked.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1
            return acc
        }, {}),
        trend,
        riskBreakdown: riskData.breakdown,
        stalenessFlags: riskData.stalenessFlags,
        recommendation:
            riskData.riskScore > 0.6
                ? "HIGH RISK: Mandate quality inspection before payment. Notify procurement team."
                : riskData.riskScore > 0.3
                    ? "MODERATE RISK: Request documentation review and spot checks."
                    : "LOW RISK: Proceed with standard processing. Consider early payment discount.",
    }

    // ── Human-readable explanation ───────────────────────────────────────────
    const explanation = generateExplanation(immediateContext, historicalContext, temporalContext, experientialContext, riskData)

    const contextObject = {
        cacheHit: false,
        generatedAt: new Date().toISOString(),
        immediateContext,
        historicalContext,
        temporalContext,
        experientialContext,
        explanation,
    }

    // Cache result in Redis
    try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(contextObject))
    } catch (err) {
        console.warn("[ContextService] Failed to cache:", err.message)
    }

    return contextObject
}

function generateExplanation(immediate, historical, temporal, experiential, riskData) {
    let lines = []
    lines.push(`DECISION CONTEXT for Supplier "${immediate.supplierName}" (ID: ${immediate.supplierId})`)
    lines.push(`Risk Score: ${immediate.currentRiskScore} → ${experiential.recommendation}`)
    lines.push("")
    lines.push("HISTORICAL MEMORY:")
    if (historical.freshEventCount === 0) {
        lines.push("  No recent events found. Insufficient historical data.")
    } else {
        historical.topMemories.slice(0, 3).forEach((e) => {
            lines.push(`  • [${e.ageMonths}mo ago] ${e.type.toUpperCase()} — Severity ${e.severity} — ₹${e.impactCost.toLocaleString("en-IN")} impact${e.description ? ` — "${e.description}"` : ""}`)
        })
    }
    lines.push("")
    lines.push("TEMPORAL:")
    lines.push(`  ${temporal.stalenessNote}`)
    if (temporal.seasonalPatterns.length > 0) {
        temporal.seasonalPatterns.forEach((p) => lines.push(`  ${p}`))
    }
    lines.push("")
    lines.push("EXPERIENTIAL:")
    lines.push(`  Total loss documented: ₹${experiential.totalDocumentedLoss.toLocaleString("en-IN")}`)
    lines.push(`  Performance trend: ${experiential.trend.direction.toUpperCase()}`)
    lines.push(`  Avg severity: ${(experiential.averageSeverity * 10).toFixed(1)}/10`)
    return lines.join("\n")
}

/**
 * Invalidate cached context for a supplier (call after new event is logged)
 */
async function invalidateCache(supplierId) {
    try {
        await redisClient.del(`context:supplier:${supplierId}`)
        console.log(`[ContextService] Cache invalidated for supplier ${supplierId}`)
    } catch (err) {
        console.warn("[ContextService] Cache invalidation failed:", err.message)
    }
}

module.exports = {
    buildContext,
    invalidateCache,
}
