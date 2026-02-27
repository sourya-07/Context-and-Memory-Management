//   GET  /supplier          — list all suppliers
//   GET  /supplier/:id      — get a supplier's full memory profile
//   GET  /supplier/:id/context — get the 4-layer AI context for a supplier
//   POST /supplier          — create a new supplier

const prisma = require("../config/prisma")
const { buildContext } = require("../services/contextService")
const { getDetailedRisk } = require("../services/riskService")
const { getMemoriesForSupplier } = require("../services/memoryService")

// GET /supplier
// Returns all suppliers with their event and invoice counts.
// Used on the Suppliers list page.
async function listAllSuppliers(req, res) {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: { id: "asc" },
            include: {
                // Include counts of related records so the UI can display them without extra queries
                _count: {
                    select: { events: true, invoices: true },
                },
            },
        })
        res.json(suppliers)
    } catch (error) {
        console.error("[SupplierController] Error fetching supplier list:", error)
        res.status(500).json({ error: "Could not fetch suppliers." })
    }
}


// GET /supplier/:id
// Returns a supplier's full profile including:
//   - All their logged events
//   - Their 5 most recent invoices
//   - A ranked memory breakdown (fresh / stale / archived)
//   - A detailed risk score and per-event breakdown
async function getSupplierProfile(req, res) {
    try {
        const supplierId = parseInt(req.params.id)

        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
            include: {
                events: { orderBy: { createdAt: "desc" } },         // all events, newest first
                invoices: { orderBy: { createdAt: "desc" }, take: 5 }, // only last 5 invoices
            },
        })

        if (!supplier) {
            return res.status(404).json({ error: "Supplier not found." })
        }

        // Fetch memories and risk score at the same time to keep things fast
        const [memories, riskData] = await Promise.all([
            getMemoriesForSupplier(supplierId),
            getDetailedRisk(supplierId),
        ])

        res.json({ supplier, memories, riskData })
    } catch (error) {
        console.error("[SupplierController] Error fetching supplier profile:", error)
        res.status(500).json({ error: "Could not load supplier profile." })
    }
}


// GET /supplier/:id/context
// Returns the full 4-layer AI context for a supplier.
// Uses the same context-building logic as invoice processing.
// Useful for exploring a supplier's memory outside of an invoice decision.
async function getAIContextForSupplier(req, res) {
    try {
        const context = await buildContext(req.params.id)
        res.json(context)
    } catch (error) {
        console.error("[SupplierController] Error building supplier context:", error)

        // Return 404 if the supplier doesn't exist, otherwise 500
        const statusCode = error.message === "Supplier not found" ? 404 : 500
        res.status(statusCode).json({ error: error.message })
    }
}


// POST /supplier
// Creates a new supplier with the given name.
async function createNewSupplier(req, res) {
    try {
        const { name } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "A supplier name is required." })
        }

        const newSupplier = await prisma.supplier.create({
            data: { name: name.trim() },
        })

        res.status(201).json(newSupplier)
    } catch (error) {
        console.error("[SupplierController] Error creating supplier:", error)
        res.status(500).json({ error: "Could not create the supplier." })
    }
}

module.exports = {
    listAllSuppliers,
    getSupplierProfile,
    getAIContextForSupplier,
    createNewSupplier,
    // Backward-compatible aliases so existing route files don't break
    listSuppliers: listAllSuppliers,
    getSupplier: getSupplierProfile,
    getSupplierContext: getAIContextForSupplier,
    createSupplier: createNewSupplier,
}
