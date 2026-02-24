const prisma = require("../config/prisma")
const { redisClient } = require("../config/redis")
const { getSupplierRisk } = require("./riskService")


async function processInvoice(supplierId, amount) {

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

    // 3. Decide recommendation
    let recommendation = "Safe"

    if (risk > 0.6) {
        recommendation = "High Risk – Inspect"
    } else if (risk > 0.3) {
        recommendation = "Moderate Risk – Review"
    }

    return {
        invoiceId: invoice.id,
        risk,
        recommendation
    }
}

module.exports = {
    processInvoice
}