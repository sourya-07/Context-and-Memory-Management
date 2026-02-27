//   POST /invoice         — process a new invoice through the AI system
//   GET  /invoice/:id     — get an invoice with its AI decision and context
//   GET  /invoice         — get all invoices (for the dashboard table)

const { processInvoice, getInvoiceById, getAllInvoices } = require("../services/invoiceService")

// POST /invoice
// Accepts supplierId and amount, runs the AI context analysis,
// and returns the invoice ID plus the risk decision.
async function handleCreateInvoice(req, res) {
    try {
        const { supplierId, amount } = req.body

        if (!supplierId || !amount) {
            return res.status(400).json({
                error: "Both supplierId and amount are required to process an invoice.",
            })
        }

        const result = await processInvoice(supplierId, amount)

        res.status(201).json(result)
    } catch (error) {
        console.error("[InvoiceController] Error processing invoice:", error)
        res.status(500).json({ error: "Something went wrong while processing the invoice." })
    }
}

// GET /invoice/:id
// Returns a single invoice with its AI decision and the full context snapshot.
async function handleFetchInvoice(req, res) {
    try {
        const invoiceId = req.params.id
        const result = await getInvoiceById(invoiceId)
        res.json(result)
    } catch (error) {
        // getInvoiceById throws if the invoice doesn't exist
        res.status(404).json({ error: error.message })
    }
}

// GET /invoice
// Returns all invoices for the dashboard, most recent first.
async function handleFetchAllInvoices(req, res) {
    try {
        const allInvoices = await getAllInvoices()
        res.json(allInvoices)
    } catch (error) {
        console.error("[InvoiceController] Error fetching invoices:", error)
        res.status(500).json({ error: "Could not fetch invoices." })
    }
}

module.exports = {
    handleCreateInvoice,
    handleFetchInvoice,
    handleFetchAllInvoices,
    // Backward-compatible aliases so route files don't need to change
    createInvoice: handleCreateInvoice,
    fetchInvoice: handleFetchInvoice,
    fetchAllInvoices: handleFetchAllInvoices,
}