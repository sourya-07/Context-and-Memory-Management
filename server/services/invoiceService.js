// invoiceService.js
// Handles the full lifecycle of an invoice:
//   1. Save it to the database
//   2. Run the AI context analysis (4-layer memory system)
//   3. Make a risk-based decision (APPROVED / REVIEW / HOLD)
//   4. Store the decision log for future reference

const prisma = require("../config/prisma")
const { getSupplierRisk } = require("./riskService")
const { buildContext } = require("./contextService")

// Risk thresholds for decision making
const HIGH_RISK_THRESHOLD = 0.6   // above this → put invoice on HOLD
const MODERATE_RISK_THRESHOLD = 0.3  // above this → flag for REVIEW

// ─────────────────────────────────────────────────────────────────────────────
// Process a new invoice — the main function called when someone submits the form.
//
// Steps:
//   1. Verify the supplier exists
//   2. Save the invoice with PENDING status
//   3. Build the AI context (4-layer memory analysis)
//   4. Determine risk level and update the invoice status
//   5. Save the decision log with a full context snapshot
// ─────────────────────────────────────────────────────────────────────────────
async function processNewInvoice(supplierId, invoiceAmount) {
    const id = parseInt(supplierId)

    // Make sure the supplier exists before doing anything
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new Error("Supplier not found")

    // Step 1: Save the invoice with a PENDING status (will be updated after analysis)
    const savedInvoice = await prisma.invoice.create({
        data: {
            supplierId: id,
            amount: invoiceAmount,
            status: "PENDING",
        },
    })

    // Step 2: Build the full 4-layer AI context for this supplier
    // (Redis-cached if available, so repeated requests are fast)
    const aiContext = await buildContext(id, {
        invoiceAmount,
        invoiceId: savedInvoice.id,
    })

    const riskScore = aiContext.immediateContext.currentRiskScore

    // Step 3: Decide what to do based on the risk score
    let decisionLabel = "Safe to Approve"
    let invoiceStatus = "APPROVED"

    if (riskScore > HIGH_RISK_THRESHOLD) {
        decisionLabel = "High Risk — Mandate quality inspection before payment"
        invoiceStatus = "HOLD"
    } else if (riskScore > MODERATE_RISK_THRESHOLD) {
        decisionLabel = "Moderate Risk — Request documentation review"
        invoiceStatus = "REVIEW"
    }

    // Step 4: Update the invoice status now that we have a decision
    await prisma.invoice.update({
        where: { id: savedInvoice.id },
        data: { status: invoiceStatus },
    })

    // Step 5: Save the decision log
    // We store the full context snapshot in JSON so we can replay the decision later
    await prisma.decisionLog.create({
        data: {
            invoiceId: savedInvoice.id,
            riskScore,
            explanation: aiContext.explanation,
            contextSnapshot: JSON.stringify(aiContext),
        },
    })

    return {
        invoiceId: savedInvoice.id,
        risk: riskScore,
        recommendation: decisionLabel,
        status: invoiceStatus,
        context: aiContext,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get a single invoice with its AI decision and the full context snapshot.
// Used on the Invoice Details page.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchInvoiceWithDecision(invoiceId) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: parseInt(invoiceId) },
        include: { supplier: true },
    })

    if (!invoice) throw new Error("Invoice not found")

    // Look up the AI decision that was made when this invoice was processed
    const decisionRecord = await prisma.decisionLog.findFirst({
        where: { invoiceId: invoice.id },
    })

    // Parse the stored JSON snapshot back into an object
    let contextSnapshot = null
    if (decisionRecord?.contextSnapshot) {
        try {
            contextSnapshot = JSON.parse(decisionRecord.contextSnapshot)
        } catch {
            // If parsing fails (e.g. corrupted data), just return null — the UI handles it
            contextSnapshot = null
        }
    }

    return {
        invoice,
        decision: decisionRecord
            ? {
                id: decisionRecord.id,
                invoiceId: decisionRecord.invoiceId,
                riskScore: decisionRecord.riskScore,
                explanation: decisionRecord.explanation,
                createdAt: decisionRecord.createdAt,
            }
            : null,
        context: contextSnapshot,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get all invoices — used to populate the Dashboard table.
// Returns most recent first.
// ─────────────────────────────────────────────────────────────────────────────
async function listAllInvoices() {
    return prisma.invoice.findMany({
        orderBy: { id: "desc" },
        include: {
            supplier: { select: { name: true } },
        },
    })
}

module.exports = {
    processNewInvoice,
    fetchInvoiceWithDecision,
    listAllInvoices,
    // Backward-compatible aliases matching the original exported names
    processInvoice: processNewInvoice,
    getInvoiceById: fetchInvoiceWithDecision,
    getAllInvoices: listAllInvoices,
}