// contextService.js
// Builds the 4-layer AI context object that explains WHY the agent made its decision.
//
// The 4 layers mirror how an experienced human professional thinks:
//   Layer 1 — Immediate:    What's happening right now? (invoice amount, supplier, date)
//   Layer 2 — Historical:   What has this supplier done in the past 12 months?
//   Layer 3 — Temporal:     Are there older events that are getting stale? Any seasonal patterns?
//   Layer 4 — Experiential: What have we learned about this supplier overall? Are they improving?
//
// Results are cached in Redis so repeated invoice requests for the same supplier are fast.

const { getMemoriesForSupplier } = require("./memoryService")
const { getDetailedRisk } = require("./riskService")
const { safeGet, safeSetEx, safeDel } = require("../config/redis")
const prisma = require("../config/prisma")

// How long to keep a context result in Redis (5 minutes)
const CACHE_LIFETIME_SECONDS = 300

// ─────────────────────────────────────────────────────────────────────────────
// Look for patterns of issues during summer (Mar–May) and monsoon (Jun–Sep) months.
// If we see 2+ events in the same season, we flag it as a recurring pattern.
// ─────────────────────────────────────────────────────────────────────────────
function detectSeasonalPatterns(events) {
    const summerMonthIndices = [2, 3, 4]      // March, April, May (0-indexed)
    const monsoonMonthIndices = [5, 6, 7, 8]   // June, July, August, September

    const summerEvents = events.filter(e => summerMonthIndices.includes(new Date(e.createdAt).getMonth()))
    const monsoonEvents = events.filter(e => monsoonMonthIndices.includes(new Date(e.createdAt).getMonth()))

    const detectedPatterns = []

    if (summerEvents.length >= 2)
        detectedPatterns.push("Elevated quality issues during summer months (Mar–May). Possible heat-sensitive packaging risk.")

    if (monsoonEvents.length >= 2)
        detectedPatterns.push("Delivery delays logged during monsoon season (Jun–Sep). Potential logistics vulnerability.")

    return detectedPatterns
}

// ─────────────────────────────────────────────────────────────────────────────
// Is this supplier getting better or worse?
// We compare the average severity in the newer half of events vs the older half.
// Needs at least 4 events to produce a meaningful result.
// ─────────────────────────────────────────────────────────────────────────────
function assessPerformanceTrend(rankedEvents) {
    if (rankedEvents.length < 4) return { direction: "insufficient_data", delta: 0 }

    const midpoint = Math.ceil(rankedEvents.length / 2)
    const recentEvents = rankedEvents.slice(0, midpoint)  // first half = most recent
    const olderEvents = rankedEvents.slice(midpoint)     // second half = older

    const recentAverageSeverity = recentEvents.reduce((sum, e) => sum + e.severity, 0) / recentEvents.length
    const olderAverageSeverity = olderEvents.reduce((sum, e) => sum + e.severity, 0) / olderEvents.length

    // If the older events were worse than recent ones, the supplier is improving
    const delta = parseFloat((olderAverageSeverity - recentAverageSeverity).toFixed(3))

    return {
        direction: delta > 0.05 ? "improving" : delta < -0.05 ? "deteriorating" : "stable",
        delta,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function — builds the full 4-layer context for a supplier.
//
// Optional `immediateData` can include invoiceAmount and invoiceId
// to add the current transaction into Layer 1.
// ─────────────────────────────────────────────────────────────────────────────
async function buildContext(supplierId, immediateData = {}) {
    const id = parseInt(supplierId)
    const cacheKey = `context:supplier:${id}`

    // ── Try Redis first ────────────────────────────────────────────────────
    const cached = await safeGet(cacheKey)
    if (cached) {
        console.log(`[Context] Serving supplier ${id} context from Redis cache`)
        const parsed = JSON.parse(cached)

        // Inject the current invoice amount into the cached result before returning
        if (immediateData.invoiceAmount) {
            parsed.immediateContext.invoiceAmount = immediateData.invoiceAmount
        }

        parsed.cacheHit = true
        return parsed
    }
    console.log(`[Context] Cache miss for supplier ${id} — computing fresh context`)

    // ── Fetch supplier from DB ─────────────────────────────────────────────
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new Error("Supplier not found")

    // Fetch memories and risk score in parallel to save time
    const [memories, riskData] = await Promise.all([
        getMemoriesForSupplier(id),
        getDetailedRisk(id),
    ])

    const performanceTrend = assessPerformanceTrend(memories.ranked)
    const seasonalPatterns = detectSeasonalPatterns(memories.ranked)

    // ── Layer 1: Immediate Context ─────────────────────────────────────────
    // Everything about the current transaction
    const immediateContext = {
        supplierId: id,
        supplierName: supplier.name,
        invoiceAmount: immediateData.invoiceAmount || null,
        processingDate: new Date().toISOString(),
        currentRiskScore: parseFloat(riskData.riskScore.toFixed(3)),
    }

    // ── Layer 2: Historical Context ────────────────────────────────────────
    // Recent events (< 12 months), ranked by relevance — these have the most influence
    const historicalContext = {
        freshEventCount: memories.fresh.length,
        topMemories: memories.fresh.slice(0, 5).map(e => ({
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

    // ── Layer 3: Temporal Context ──────────────────────────────────────────
    // Stale and archived events, plus any seasonal patterns detected
    const temporalContext = {
        staleEventCount: memories.stale.length,
        archivedEventCount: memories.archived.length,
        staleEvents: memories.stale.slice(0, 3).map(e => ({
            id: e.id,
            type: e.type,
            severity: e.severity,
            impactCost: e.impactCost,
            decayFactor: e.decayFactor,
            ageMonths: e.ageMonths,
            memoryStatus: e.memoryStatus,
            note: "Downweighted due to age — may reflect issues that have already been resolved",
        })),
        seasonalPatterns,
        stalenessNote: memories.stale.length > 0
            ? `${memories.stale.length} event(s) are 12–24 months old and carry reduced weight.`
            : "No stale events found.",
    }

    // ── Layer 4: Experiential Context ──────────────────────────────────────
    // Big-picture learnings: total losses, average severity, trend, event breakdown
    const totalFinancialLoss = memories.ranked.reduce((sum, e) => sum + e.impactCost, 0)
    const averageSeverity = memories.ranked.length > 0
        ? memories.ranked.reduce((sum, e) => sum + e.severity, 0) / memories.ranked.length
        : 0

    // Group events by type so we can see what kinds of problems keep recurring
    const eventTypeBreakdown = memories.ranked.reduce((counts, e) => {
        counts[e.type] = (counts[e.type] || 0) + 1
        return counts
    }, {})

    // Generate a plain-English recommendation based on the risk score
    const riskScore = riskData.riskScore
    let recommendation
    if (riskScore > 0.6) {
        recommendation = "HIGH RISK: Mandate quality inspection before payment. Notify the procurement team."
    } else if (riskScore > 0.3) {
        recommendation = "MODERATE RISK: Request documentation review and spot checks."
    } else {
        recommendation = "LOW RISK: Proceed with standard processing. Consider offering an early-payment discount."
    }

    const experientialContext = {
        totalDocumentedLoss: totalFinancialLoss,
        averageSeverity: parseFloat(averageSeverity.toFixed(3)),
        eventTypeBreakdown,
        trend: performanceTrend,
        riskBreakdown: riskData.breakdown,
        stalenessFlags: riskData.stalenessFlags,
        recommendation,
    }

    // ── Build the explanation text ─────────────────────────────────────────
    const explanation = buildDecisionExplanation(
        immediateContext,
        historicalContext,
        temporalContext,
        experientialContext
    )

    const contextResult = {
        cacheHit: false,
        generatedAt: new Date().toISOString(),
        immediateContext,
        historicalContext,
        temporalContext,
        experientialContext,
        explanation,
    }

    // ── Cache in Redis (non-fatal if Redis is unavailable) ────────────────
    await safeSetEx(cacheKey, CACHE_LIFETIME_SECONDS, JSON.stringify(contextResult))

    return contextResult
}

// ─────────────────────────────────────────────────────────────────────────────
// Builds the plain-English explanation string that goes into the decision log.
// This is what the user reads to understand why the AI made its decision.
// ─────────────────────────────────────────────────────────────────────────────
function buildDecisionExplanation(immediate, historical, temporal, experiential) {
    const lines = []

    lines.push(`DECISION CONTEXT for Supplier "${immediate.supplierName}" (ID: ${immediate.supplierId})`)
    lines.push(`Risk Score: ${immediate.currentRiskScore} → ${experiential.recommendation}`)
    lines.push("")

    lines.push("HISTORICAL MEMORY:")
    if (historical.freshEventCount === 0) {
        lines.push("  No recent events found.")
    } else {
        historical.topMemories.slice(0, 3).forEach(e => {
            const costFormatted = e.impactCost.toLocaleString("en-IN")
            const descriptionNote = e.description ? ` — "${e.description}"` : ""
            lines.push(`  • [${e.ageMonths}mo ago] ${e.type.toUpperCase()} — Severity ${e.severity} — ₹${costFormatted} impact${descriptionNote}`)
        })
    }

    lines.push("")
    lines.push("TEMPORAL:")
    lines.push(`  ${temporal.stalenessNote}`)
    temporal.seasonalPatterns.forEach(pattern => lines.push(`  ${pattern}`))

    lines.push("")
    lines.push("EXPERIENTIAL:")
    lines.push(`  Total documented loss: ₹${experiential.totalDocumentedLoss.toLocaleString("en-IN")}`)
    lines.push(`  Performance trend: ${experiential.trend.direction.toUpperCase()}`)
    lines.push(`  Average severity: ${(experiential.averageSeverity * 10).toFixed(1)}/10`)

    return lines.join("\n")
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear the cached context for a supplier.
// This should be called every time a new event is logged for that supplier,
// so the next invoice decision uses up-to-date information.
// ─────────────────────────────────────────────────────────────────────────────
async function invalidateSupplierCache(supplierId) {
    await safeDel(`context:supplier:${supplierId}`)
    console.log(`[Context] Cache cleared for supplier ${supplierId}`)
}

// Export under both old and new names so existing code doesn't break
module.exports = {
    buildContext,
    invalidateSupplierCache,
    invalidateCache: invalidateSupplierCache,  // backward-compatible alias
}
