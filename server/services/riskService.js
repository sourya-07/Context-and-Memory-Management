// Calculates how risky a supplier is, based on their full event history.
// Each past event contributes to total risk score, but older events contribute less
// because their memory decays exponentially over time.

const prisma = require("../config/prisma")
const { calculateDecay, getMemoryStatus, computeRelevanceScore, getAgeInMonths } = require("./memoryService")


// Calculate how much a single event raises the overall risk score.
// This combines severity, financial impact, how recent the event is, and confidence.
// Note: costScore divides by 1,00,000 (₹1L) to normalize the cost into a 0–1 range.
function calculateSingleEventRisk(event) {
    const decayFactor = calculateDecay(event.createdAt, event.memoryTag)

    const severityScore = 0.4 * event.severity
    const costScore = 0.3 * (event.impactCost / 100000)  // normalized to ₹1L
    const recencyScore = 0.2 * decayFactor
    const confidenceScore = 0.1 * event.confidence

    return severityScore + costScore + recencyScore + confidenceScore
}


// Quick risk score — just a single number between 0 and 1.
// Used when processing a new invoice to decide APPROVED / REVIEW / HOLD.

async function getSupplierRisk(supplierId) {
    const id = parseInt(supplierId)
    const allEvents = await prisma.event.findMany({ where: { supplierId: id } })

    let totalRisk = 0
    for (const event of allEvents) {
        totalRisk += calculateSingleEventRisk(event)
    }

    // Risk score is capped at 1.0 — anything above that is still "maximum risk"
    return Math.min(totalRisk, 1)
}

// Detailed risk breakdown — used inside the AI context layers.
// Returns the overall score plus per-event contributions and staleness flags.
async function getDetailedRisk(supplierId) {
    const id = parseInt(supplierId)

    const allEvents = await prisma.event.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: "desc" },  // most recent first
    })

    let totalRisk = 0
    const eventBreakdown = []   // how much each event contributes
    const stalenessWarnings = []  // events the UI should flag as old

    for (const event of allEvents) {
        const contribution = calculateSingleEventRisk(event)
        const status = getMemoryStatus(event)
        const decay = parseFloat(calculateDecay(event.createdAt, event.memoryTag).toFixed(3))
        const relevance = parseFloat(computeRelevanceScore(event).toFixed(3))
        const ageMonths = parseFloat(getAgeInMonths(event.createdAt).toFixed(1))

        totalRisk += contribution

        eventBreakdown.push({
            eventId: event.id,
            type: event.type,
            contribution: parseFloat(contribution.toFixed(3)),
            severity: event.severity,
            impactCost: event.impactCost,
            decayFactor: decay,
            relevanceScore: relevance,
            ageMonths,
            memoryStatus: status,
            memoryTag: event.memoryTag,
        })

        // Stale and archived events should be highlighted in the UI so the user
        // knows they carry less weight than recent ones
        if (status === "stale" || status === "archived") {
            stalenessWarnings.push({
                eventId: event.id,
                type: event.type,
                status,
                ageMonths,
                note: status === "archived"
                    ? "This event is over 24 months old. It has minimal influence on today's risk score."
                    : "This event is 12–24 months old. It is downweighted in the risk calculation.",
            })
        }
    }

    return {
        riskScore: Math.min(totalRisk, 1),  // capped at 1.0
        breakdown: eventBreakdown,
        stalenessFlags: stalenessWarnings,
        eventCount: allEvents.length,
    }
}

module.exports = { getSupplierRisk, getDetailedRisk }