import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { createInvoice, getSuppliers } from "../services/api"

// Describes what each "layer" of AI context the agent uses when making a decision
const CONTEXT_LAYERS = [
  {
    layer: "Immediate",
    description: "Current invoice amount, supplier details, and today's date",
  },
  {
    layer: "Historical",
    description: "Recent events within the last 12 months, ranked by how relevant they are",
  },
  {
    layer: "Temporal",
    description: "Older events (12–24 months) still included but given reduced weight",
  },
  {
    layer: "Experiential",
    description: "Big-picture patterns: total losses, average severity, and performance trend",
  },
]

function CreateInvoice() {
  const [supplierList, setSupplierList] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [invoiceAmount, setInvoiceAmount] = useState("")

  const [isProcessing, setIsProcessing] = useState(false)   // true while the AI is running
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  const navigate = useNavigate()

  // Fetch the available suppliers when the form loads
  useEffect(() => {
    getSuppliers()
      .then(setSupplierList)
      .catch(() => setErrorMessage("Could not load suppliers. Please refresh."))
      .finally(() => setIsLoadingSuppliers(false))
  }, [])

  // Called when the user clicks "Process Invoice"
  async function handleProcessInvoice(e) {
    e.preventDefault()
    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const result = await createInvoice({
        supplierId: Number(selectedSupplierId),
        amount: Number(invoiceAmount),
      })
      // Navigate directly to the invoice details page where the AI decision is shown
      navigate(`/invoice/${result.invoiceId}`)
    } catch {
      setErrorMessage("Failed to process the invoice. Make sure the supplier is valid and try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  // Used to show supplier info in the right panel when one is selected
  const chosenSupplier = supplierList.find(s => s.id === Number(selectedSupplierId))

  return (
    <div className="page animate-in">

      {/* page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Process an Invoice</h1>
          <p className="page-subtitle">
            The AI will analyse the supplier's memory and generate a risk-aware decision
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">← Back to Dashboard</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>

        {/* Invoice Form */}
        <div className="form-card">
          <div className="section-title">Invoice Details</div>

          {errorMessage && (
            <div className="error-box" style={{ marginBottom: "1.25rem" }}>{errorMessage}</div>
          )}

          <form onSubmit={handleProcessInvoice} className="form-grid">

            {/* Supplier picker — shows name + how many events exist */}
            <div className="form-group">
              <label className="form-label">Supplier</label>
              {isLoadingSuppliers ? (
                <div className="form-input" style={{ color: "var(--text-muted)" }}>
                  Loading suppliers…
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  required
                >
                  <option value="">Choose a supplier…</option>
                  {supplierList.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} (#{supplier.id}) — {supplier._count?.events || 0} events on record
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Invoice amount */}
            <div className="form-group">
              <label className="form-label">Invoice Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 250000"
                value={invoiceAmount}
                onChange={e => setInvoiceAmount(e.target.value)}
                min="1"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing || isLoadingSuppliers}
              style={{ marginTop: "0.5rem" }}
            >
              {isProcessing ? "Running AI analysis…" : "Process with AI Context"}
            </button>
          </form>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* If a supplier is selected, show their quick stats */}
          {chosenSupplier ? (
            <div className="glass-card" style={{ padding: "1.5rem" }}>
              <div className="section-title">Selected Supplier</div>
              <div className="context-kv">
                <span className="context-key">Name</span>
                <span className="context-val" style={{ fontWeight: 700 }}>{chosenSupplier.name}</span>

                <span className="context-key">Supplier ID</span>
                <span className="context-val">#{chosenSupplier.id}</span>

                <span className="context-key">Events on Record</span>
                <span className="context-val">{chosenSupplier._count?.events || 0}</span>

                <span className="context-key">Past Invoices</span>
                <span className="context-val">{chosenSupplier._count?.invoices || 0}</span>
              </div>

              {/* Brief explainer of what happens next */}
              <div style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "rgba(168, 218, 220, 0.15)",
                borderRadius: "8px",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}>
                The AI agent will pull all historical memory for this supplier, apply
                temporal decay and staleness detection, then produce a ranked relevance
                score before making its decision.
              </div>
            </div>
          ) : (
            /* If no supplier is chosen yet, explain how the AI context works */
            <div className="glass-card" style={{ padding: "1.5rem" }}>
              <div className="section-title">How the AI Decides</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {CONTEXT_LAYERS.map((item, index) => (
                  <div key={item.layer} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    {/* Layer number badge */}
                    <div style={{
                      width: 24, height: 24, borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(168, 218, 220, 0.15)",
                      color: "var(--color-teal)",
                      fontSize: "0.7rem", fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {item.layer}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show a hint if there are no suppliers at all */}
          {supplierList.length === 0 && !isLoadingSuppliers && (
            <div className="glass-card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                No suppliers found.
              </div>
              <Link to="/suppliers" className="btn-link">
                Add a supplier first →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreateInvoice