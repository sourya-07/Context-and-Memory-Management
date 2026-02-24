const { processInvoice, getInvoiceById } = require("../services/invoiceService")

async function createInvoice(req, res) {
    try {
        const { supplierId, amount } = req.body

        // Basic validation
        if (!supplierId || !amount) {
            return res.status(400).json({
                error: "supplierId and amount are required"
            })
        }

        const result = await processInvoice(supplierId, amount)

        res.status(201).json(result)

    } catch (error) {
        console.error(error)
        res.status(500).json({
            error: "Internal server error"
        })
    }
}

// Get Invoice by ID
async function fetchInvoice(req, res) {
    try {
        const { id } = req.params

        const result = await getInvoiceById(id)

        res.json(result)

    } catch (error) {
        res.status(404).json({
            error: error.message
        })
    }
}

module.exports = {
    createInvoice,
    fetchInvoice
}