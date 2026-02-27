//   POST /event        — log a new event (quality issue, delay, etc.)
//   GET  /event/supplier/:id — get all events for a given supplier
const prisma = require("../config/prisma")
const { invalidateCache } = require("../services/contextService")


// POST /event
// Log a new event for a supplier. This becomes part of their memory that the
// AI agent will draw on when making future invoice decisions.

// Required fields: supplierId, type, severity, impactCost, confidence
// Optional fields: description, memoryTag (defaults to "time_sensitive")
async function logNewEvent(req, res) {
    try {
        const { supplierId, type, severity, impactCost, confidence, description, memoryTag } = req.body

        // Validate that all required fields are present
        const isMissingRequiredField = !supplierId || !type || severity == null || impactCost == null || confidence == null
        if (isMissingRequiredField) {
            return res.status(400).json({
                error: "Missing required fields. Please send: supplierId, type, severity, impactCost, confidence",
            })
        }

        const id = parseInt(supplierId)

        // Make sure the supplier actually exists before creating the event
        const supplier = await prisma.supplier.findUnique({ where: { id } })
        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found. Check the supplierId and try again." })
        }

        // Save the event to the database
        const savedEvent = await prisma.event.create({
            data: {
                supplierId: id,
                type,
                severity: parseFloat(severity),
                impactCost: parseFloat(impactCost),
                confidence: parseFloat(confidence),
                description: description || null,
                // If no memoryTag is provided, default to time_sensitive (will decay over time)
                memoryTag: memoryTag || "time_sensitive",
            },
        })

        // Clear the Redis cache for this supplier so the next invoice decision
        // is freshly computed with this new event included
        await invalidateCache(id)

        res.status(201).json({
            event: savedEvent,
            message: "Event saved successfully. The supplier's context cache has been cleared.",
        })
    } catch (error) {
        console.error("[EventController] Error logging event:", error)
        res.status(500).json({ error: "Something went wrong while saving the event." })
    }
}

// GET /event/supplier/:id
// Returns all events logged for a specific supplier, sorted newest first.
async function getEventsForSupplier(req, res) {
    try {
        const supplierId = parseInt(req.params.id)

        const events = await prisma.event.findMany({
            where: { supplierId },
            orderBy: { createdAt: "desc" },
        })

        res.json(events)
    } catch (error) {
        console.error("[EventController] Error fetching events:", error)
        res.status(500).json({ error: "Could not fetch events for this supplier." })
    }
}

module.exports = { logNewEvent, getEventsForSupplier, logEvent: logNewEvent, getEventsBySupplier: getEventsForSupplier }
