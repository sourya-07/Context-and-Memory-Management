// The core memory engine — decides how "relevant" each past event is to a decision today.
// Newer events matter more than old ones. The score decays over time (like human memory).

const prisma = require("../config/prisma")

// events older than this are considered stale
const FRESH_LIMIT = 12  // months
const STALE_LIMIT = 24  // months

// how many months ago did this event happen?
function getAgeInMonths(createdAt) {
    const now = new Date()
    const then = new Date(createdAt)
    return (now - then) / (1000 * 60 * 60 * 24 * 30)
}

// fresh, stale, archived, or evergreen
// evergreen events never expire (e.g. a contract term)
function getMemoryStatus(event) {
    if (event.memoryTag === "evergreen") return "evergreen"

    const age = getAgeInMonths(event.createdAt)
    if (age < FRESH_LIMIT) return "fresh"
    if (age < STALE_LIMIT) return "stale"
    return "archived"
}

// older memories should matter less — exponential decay
// evergreen ones always stay at 1.0 (full weight)
function calculateDecay(createdAt, memoryTag) {
    if (memoryTag === "evergreen") return 1.0
    const months = getAgeInMonths(createdAt)
    return Math.exp(-0.2 * months)
}

// composite score to rank events by how important they are right now
// severity matters most, then how recent it is, then cost, then confidence
function computeRelevanceScore(event) {
    const decay = calculateDecay(event.createdAt, event.memoryTag)
    const normalizedCost = Math.min(event.impactCost / 500000, 1)
    return (
        0.4 * event.severity +
        0.3 * decay +
        0.2 * normalizedCost +
        0.1 * event.confidence
    )
}

// sort events from most to least relevant
function rankMemories(events) {
    return events
        .map(event => ({
            ...event,
            memoryStatus: getMemoryStatus(event),
            decayFactor: parseFloat(calculateDecay(event.createdAt, event.memoryTag).toFixed(3)),
            relevanceScore: parseFloat(computeRelevanceScore(event).toFixed(3)),
            ageMonths: parseFloat(getAgeInMonths(event.createdAt).toFixed(1)),
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

// turn ranked events into a quick text summary for the decision log
function summarizeMemory(rankedEvents) {
    if (rankedEvents.length === 0) {
        return "No historical events found for this supplier. No prior risk context available."
    }

    const fresh = rankedEvents.filter(e => e.memoryStatus === "fresh")
    const stale = rankedEvents.filter(e => e.memoryStatus === "stale")
    const archived = rankedEvents.filter(e => e.memoryStatus === "archived")
    const evergreen = rankedEvents.filter(e => e.memoryStatus === "evergreen")

    const totalLoss = rankedEvents.reduce((sum, e) => sum + e.impactCost, 0)
    const avgSeverity = rankedEvents.reduce((sum, e) => sum + e.severity, 0) / rankedEvents.length

    // only show the top 3 to avoid overwhelming the decision context
    const top3 = rankedEvents.slice(0, 3)

    let text = `Historical memory: ${rankedEvents.length} total events — `
    text += `${fresh.length} fresh, ${stale.length} stale, ${archived.length} archived, ${evergreen.length} evergreen.\n`
    text += `Total documented loss: ₹${totalLoss.toLocaleString("en-IN")}. Avg severity: ${(avgSeverity * 10).toFixed(1)}/10.\n`

    if (top3.length > 0) {
        text += `Top memories:\n`
        top3.forEach((e, i) => {
            text += `  ${i + 1}. [${e.type.toUpperCase()}] Severity ${e.severity} — ₹${e.impactCost.toLocaleString("en-IN")} — ${e.memoryStatus} (${e.ageMonths} months ago)`
            if (e.description) text += ` — "${e.description}"`
            text += `\n`
        })
    }

    return text.trim()
}

// main function: get all events for a supplier, rank them, return structured memory object
async function getMemoriesForSupplier(supplierId) {
    const id = parseInt(supplierId)
    const events = await prisma.event.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: "desc" },
    })

    const ranked = rankMemories(events)
    const summary = summarizeMemory(ranked)

    const fresh = ranked.filter(e => e.memoryStatus === "fresh" || e.memoryStatus === "evergreen")
    const stale = ranked.filter(e => e.memoryStatus === "stale")
    const archived = ranked.filter(e => e.memoryStatus === "archived")

    return { totalEvents: events.length, ranked, fresh, stale, archived, summary }
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
