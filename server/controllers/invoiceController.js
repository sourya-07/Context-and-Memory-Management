const { processInvoice } = require("../services/invoiceService")

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

module.exports = {
    createInvoice
}