const prisma = require("../config/prisma")
const { getSupplierRisk } = require("./riskService")


async function processInvoice(supplierId, amount) {
    const id = parseInt(supplierId)
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) {
        throw new Error('Supplier not found')
    }
    // 1. Save invoice
    const invoice = await prisma.invoice.create({
        data: {
            supplierId,
            amount,
            status: "PENDING"
        }
    })

    // 2. Calculate supplier risk
    const risk = await getSupplierRisk(supplierId)

    // 3. Decide recommendation + status
    let recommendation = "Safe"
    let status = "APPROVED"

    if (risk > 0.6) {
        recommendation = "High Risk – Inspect"
        status = "HOLD"
    } else if (risk > 0.3) {
        recommendation = "Moderate Risk – Review"
        status = "REVIEW"
    }

    // 4. Update invoice status
    await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status }
    })

    // 5. Save decision log
    await prisma.decisionLog.create({
        data: {
            invoiceId: invoice.id,
            riskScore: risk,
            explanation: "Risk calculated using historical supplier data"
        }
    })

    return {
        invoiceId: invoice.id,
        risk,
        recommendation,
        status
    }
}





// Invoice by ID
async function getInvoiceById(invoiceId) {

    const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(invoiceId) }
    })

    if (!invoice) {
        throw new Error("Invoice not found")
    }

    const decision = await prisma.decisionLog.findFirst({
        where: { invoiceId: invoice.id }
    })

    return {
        invoice,
        decision
    }
}

async function getAllInvoices() {
    const invoices = await prisma.invoice.findMany({
        orderBy: { id: "desc" }
    })
    return invoices
}

module.exports = {
    processInvoice,
    getInvoiceById,
    getAllInvoices
}