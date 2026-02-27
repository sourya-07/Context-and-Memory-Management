const prisma = require("../config/prisma")
const { buildContext } = require("../services/contextService")
const { getDetailedRisk } = require("../services/riskService")
const { getMemoriesForSupplier } = require("../services/memoryService")

// List all suppliers
async function listSuppliers(req, res) {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: { id: "asc" },
            include: {
                _count: { select: { events: true, invoices: true } },
            },
        })
        res.json(suppliers)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to fetch suppliers" })
    }
}

// Get a single supplier with memory + risk
async function getSupplier(req, res) {
    try {
        const { id } = req.params
        const supplier = await prisma.supplier.findUnique({
            where: { id: parseInt(id) },
            include: {
                events: { orderBy: { createdAt: "desc" } },
                invoices: { orderBy: { createdAt: "desc" }, take: 5 },
            },
        })
        if (!supplier) return res.status(404).json({ error: "Supplier not found" })

        const [memories, riskData] = await Promise.all([
            getMemoriesForSupplier(id),
            getDetailedRisk(id),
        ])

        res.json({ supplier, memories, riskData })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to fetch supplier profile" })
    }
}

// Get full layered context for a supplier
async function getSupplierContext(req, res) {
    try {
        const { id } = req.params
        const context = await buildContext(id)
        res.json(context)
    } catch (error) {
        console.error(error)
        res.status(error.message === "Supplier not found" ? 404 : 500).json({ error: error.message })
    }
}

// Create a new supplier
async function createSupplier(req, res) {
    try {
        const { name } = req.body
        if (!name) return res.status(400).json({ error: "name is required" })
        const supplier = await prisma.supplier.create({ data: { name } })
        res.status(201).json(supplier)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to create supplier" })
    }
}

module.exports = {
    listSuppliers,
    getSupplier,
    getSupplierContext,
    createSupplier,
}
