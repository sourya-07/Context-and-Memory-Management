const prisma = require("../config/prisma")
const {
    calculateDecay,
    getMemoryStatus,
    computeRelevanceScore,
    getAgeInMonths,
} = require("./memoryService")

function calculateEventRisk(event) {
    const decay = calculateDecay(event.createdAt, event.memoryTag)
    const severityScore = 0.4 * event.severity
    const costScore = 0.3 * (event.impactCost / 100000)
    const decayScore = 0.2 * decay
    const confidenceScore = 0.1 * event.confidence
    return severityScore + costScore + decayScore + confidenceScore
}

async function getSupplierRisk(supplierId) {
    const id = parseInt(supplierId)
    const events = await prisma.event.findMany({ where: { supplierId: id } })

    let totalRisk = 0
    for (const event of events) {
        totalRisk += calculateEventRisk(event)
    }

    if (totalRisk > 1) totalRisk = 1
    return totalRisk
}

/**
 * Returns detailed risk breakdown including per-event contributions and staleness flags.
 */
async function getDetailedRisk(supplierId) {
    const id = parseInt(supplierId)
    const events = await prisma.event.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: "desc" },
    })

    let totalRisk = 0
    const breakdown = []
    const stalenessFlags = []

    for (const event of events) {
        const contribution = calculateEventRisk(event)
        const status = getMemoryStatus(event)
        const decay = parseFloat(calculateDecay(event.createdAt, event.memoryTag).toFixed(3))
        const relevance = parseFloat(computeRelevanceScore(event).toFixed(3))
        const ageMonths = parseFloat(getAgeInMonths(event.createdAt).toFixed(1))

        totalRisk += contribution

        breakdown.push({
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

        if (status === "stale" || status === "archived") {
            stalenessFlags.push({
                eventId: event.id,
                type: event.type,
                status,
                ageMonths,
                note:
                    status === "archived"
                        ? "Event is over 24 months old. Minimal risk influence."
                        : "Event is 12–24 months old. Downweighted in risk calculation.",
            })
        }
    }

    if (totalRisk > 1) totalRisk = 1

    return {
        riskScore: totalRisk,
        breakdown,
        stalenessFlags,
        eventCount: events.length,
    }
}

module.exports = {
    getSupplierRisk,
    getDetailedRisk,
}