const prisma = require("../config/prisma")

function calculateDecay(createdAt) {
    const eventDate = new Date(createdAt)
    const now = new Date()

    const months =
        (now - eventDate) / (1000 * 60 * 60 * 24 * 30)

    const lambda = 0.2

    return Math.exp(-lambda * months)
}

function calculateEventRisk(event) {
    const decay = calculateDecay(event.createdAt)

    const severityScore = 0.4 * event.severity
    const costScore = 0.3 * (event.impactCost / 100000)
    const decayScore = 0.2 * decay
    const confidenceScore = 0.1 * event.confidence

    return severityScore + costScore + decayScore + confidenceScore
}

async function getSupplierRisk(supplierId) {
    const events = await prisma.event.findMany({
        where: { supplierId }
    })

    let totalRisk = 0

    for (const event of events) {
        totalRisk += calculateEventRisk(event)
    }

    if (totalRisk > 1) {
        totalRisk = 1
    }

    return totalRisk
}

module.exports = {
    getSupplierRisk
}