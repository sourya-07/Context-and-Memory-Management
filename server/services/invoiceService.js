const prisma = require("../config/prisma")
const { getSupplierRisk } = require("./riskService")
const { buildContext } = require("./contextService")

async function processInvoice(supplierId, amount) {
    const id = parseInt(supplierId)
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) {
        throw new Error("Supplier not found")
    }

    // 1. Save invoice
    const invoice = await prisma.invoice.create({
        data: {
            supplierId: id,
            amount,
            status: "PENDING",
        },
    })

    // 2. Build full 4-layer context (uses Redis cache when available)
    const context = await buildContext(id, { invoiceAmount: amount, invoiceId: invoice.id })

    // 3. Get risk from context (already computed inside buildContext)
    const risk = context.immediateContext.currentRiskScore

    // 4. Decide recommendation + status
    let recommendation = "Safe to Approve"
    let status = "APPROVED"

    if (risk > 0.6) {
        recommendation = "High Risk – Mandate quality inspection before payment"
        status = "HOLD"
    } else if (risk > 0.3) {
        recommendation = "Moderate Risk – Request documentation review"
        status = "REVIEW"
    }

    // 5. Update invoice status
    await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status },
    })

    // 6. Save decision log with full context snapshot
    await prisma.decisionLog.create({
        data: {
            invoiceId: invoice.id,
            riskScore: risk,
            explanation: context.explanation,
            contextSnapshot: JSON.stringify(context),
        },
    })

    return {
        invoiceId: invoice.id,
        risk,
        recommendation,
        status,
        context,
    }
}

async function getInvoiceById(invoiceId) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(invoiceId) },
        include: { supplier: true },
    })

    if (!invoice) throw new Error("Invoice not found")

    const decision = await prisma.decisionLog.findFirst({
        where: { invoiceId: invoice.id },
    })

    let parsedContext = null
    if (decision?.contextSnapshot) {
        try {
            parsedContext = JSON.parse(decision.contextSnapshot)
        } catch (e) {
            parsedContext = null
        }
    }

    return {
        invoice,
        decision: decision
            ? {
                id: decision.id,
                invoiceId: decision.invoiceId,
                riskScore: decision.riskScore,
                explanation: decision.explanation,
                createdAt: decision.createdAt,
            }
            : null,
        context: parsedContext,
    }
}

async function getAllInvoices() {
    const invoices = await prisma.invoice.findMany({
        orderBy: { id: "desc" },
        include: { supplier: { select: { name: true } } },
    })
    return invoices
}

module.exports = {
    processInvoice,
    getInvoiceById,
    getAllInvoices,
}