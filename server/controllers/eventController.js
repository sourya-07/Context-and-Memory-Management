const prisma = require("../config/prisma")
const { invalidateCache } = require("../services/contextService")

// Log a new supplier event
async function logEvent(req, res) {
    try {
        const { supplierId, type, severity, impactCost, confidence, description, memoryTag } = req.body

        if (!supplierId || !type || severity == null || impactCost == null || confidence == null) {
            return res.status(400).json({
                error: "supplierId, type, severity, impactCost, confidence are required",
            })
        }

        const id = parseInt(supplierId)
        const supplier = await prisma.supplier.findUnique({ where: { id } })
        if (!supplier) return res.status(404).json({ error: "Supplier not found" })

        const event = await prisma.event.create({
            data: {
                supplierId: id,
                type,
                severity: parseFloat(severity),
                impactCost: parseFloat(impactCost),
                confidence: parseFloat(confidence),
                description: description || null,
                memoryTag: memoryTag || "time_sensitive",
            },
        })

        // Invalidate Redis cache so next request computes fresh context
        await invalidateCache(id)

        res.status(201).json({ event, message: "Event logged and context cache invalidated" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to log event" })
    }
}

// Get all events for a supplier
async function getEventsBySupplier(req, res) {
    try {
        const { id } = req.params
        const events = await prisma.event.findMany({
            where: { supplierId: parseInt(id) },
            orderBy: { createdAt: "desc" },
        })
        res.json(events)
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch events" })
    }
}

module.exports = { logEvent, getEventsBySupplier }
