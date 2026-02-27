/**
 * memoryService.js
 * Core memory retrieval engine for the AI agent.
 * Handles memory categorization, freshness scoring, staleness detection,
 * and ranked retrieval to balance comprehensive context vs overload.
 */

const prisma = require("../config/prisma")

// Staleness thresholds (in months)
const FRESH_THRESHOLD = 12
const STALE_THRESHOLD = 24

/**
 * Calculate how many months ago an event occurred
 */
function getAgeInMonths(createdAt) {
    const now = new Date()
    const eventDate = new Date(createdAt)
    return (now - eventDate) / (1000 * 60 * 60 * 24 * 30)
}

/**
 * Determine memory lifecycle status
 * Rules:
 *   - memoryTag === "evergreen"  → always "evergreen" (never expires)
 *   - age < 12 months           → "fresh"
 *   - 12-24 months              → "stale"
 *   - > 24 months               → "archived"
 */
function getMemoryStatus(event) {
    if (event.memoryTag === "evergreen") return "evergreen"
    const ageMonths = getAgeInMonths(event.createdAt)
    if (ageMonths < FRESH_THRESHOLD) return "fresh"
    if (ageMonths < STALE_THRESHOLD) return "stale"
    return "archived"
}

/**
 * Temporal decay factor — older memories contribute less to risk.
 * Uses exponential decay: e^(-λ × months)
 */
function calculateDecay(createdAt, memoryTag) {
    if (memoryTag === "evergreen") return 1.0
    const months = getAgeInMonths(createdAt)
    const lambda = 0.2
    return Math.exp(-lambda * months)
}

/**
 * Composite relevance score for ranking memories.
 * Higher = more important to surface.
 * Formula: 0.4×severity + 0.3×decayedRecency + 0.2×normalizedCost + 0.1×confidence
 */
function computeRelevanceScore(event) {
    const decay = calculateDecay(event.createdAt, event.memoryTag)
    const normalizedCost = Math.min(event.impactCost / 500000, 1) // cap at 5L
    return (
        0.4 * event.severity +
        0.3 * decay +
        0.2 * normalizedCost +
        0.1 * event.confidence
    )
}

/**
 * Rank events by relevance score (descending)
 */
function rankMemories(events) {
    return events
        .map((event) => ({
            ...event,
            memoryStatus: getMemoryStatus(event),
            decayFactor: parseFloat(calculateDecay(event.createdAt, event.memoryTag).toFixed(3)),
            relevanceScore: parseFloat(computeRelevanceScore(event).toFixed(3)),
            ageMonths: parseFloat(getAgeInMonths(event.createdAt).toFixed(1)),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

/**
 * Summarize a set of ranked memories into concise text.
 * Prevents information overload by capping at top 3 for narrative.
 */
function summarizeMemory(rankedEvents) {
    if (rankedEvents.length === 0) {
        return "No historical events found for this supplier. No prior risk context available."
    }

    const freshEvents = rankedEvents.filter((e) => e.memoryStatus === "fresh")
    const staleEvents = rankedEvents.filter((e) => e.memoryStatus === "stale")
    const archivedEvents = rankedEvents.filter((e) => e.memoryStatus === "archived")
    const evergreenEvents = rankedEvents.filter((e) => e.memoryStatus === "evergreen")

    const totalLoss = rankedEvents.reduce((sum, e) => sum + e.impactCost, 0)
    const avgSeverity = rankedEvents.reduce((sum, e) => sum + e.severity, 0) / rankedEvents.length
    const topEvents = rankedEvents.slice(0, 3)

    let summary = `Historical memory: ${rankedEvents.length} total events — `
    summary += `${freshEvents.length} fresh, ${staleEvents.length} stale, ${archivedEvents.length} archived, ${evergreenEvents.length} evergreen.\n`
    summary += `Total documented impact cost: ₹${totalLoss.toLocaleString("en-IN")}. Avg severity: ${(avgSeverity * 10).toFixed(1)}/10.\n`

    if (topEvents.length > 0) {
        summary += `Top critical memories:\n`
        topEvents.forEach((e, i) => {
            summary += `  ${i + 1}. [${e.type.toUpperCase()}] Severity ${e.severity}/1 — ₹${e.impactCost.toLocaleString("en-IN")} impact — ${e.memoryStatus} (${e.ageMonths} months ago)`
            if (e.description) summary += ` — "${e.description}"`
            summary += `\n`
        })
    }

    return summary.trim()
}

/**
 * Main export: fetch all events for a supplier, enrich with memory metadata,
 * rank by relevance, and return structured memory object.
 */
async function getMemoriesForSupplier(supplierId) {
    const id = parseInt(supplierId)
    const events = await prisma.event.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: "desc" },
    })

    const ranked = rankMemories(events)
    const summary = summarizeMemory(ranked)

    // Categorize for structured output
    const fresh = ranked.filter((e) => e.memoryStatus === "fresh" || e.memoryStatus === "evergreen")
    const stale = ranked.filter((e) => e.memoryStatus === "stale")
    const archived = ranked.filter((e) => e.memoryStatus === "archived")

    return {
        totalEvents: events.length,
        ranked,
        fresh,
        stale,
        archived,
        summary,
    }
}

module.exports = {
    getMemoriesForSupplier,
    rankMemories,
    summarizeMemory,
    getMemoryStatus,
    computeRelevanceScore,
    calculateDecay,
    getAgeInMonths,
}
