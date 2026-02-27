import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getAllInvoices } from "../services/api"

// Maps an invoice status to the appropriate CSS badge class
const STATUS_BADGE_CLASS = {
  APPROVED: "badge-approved",
  HOLD: "badge-hold",
  REVIEW: "badge-review",
  PENDING: "badge-pending",
}

function Dashboard() {
  const [invoiceList, setInvoiceList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Load all invoices when the component mounts
  useEffect(() => {
    getAllInvoices()
      .then(setInvoiceList)
      .catch(() => setFetchError("Could not load invoices. Please refresh the page."))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return (
    <div className="loader">
      <div className="spinner" />
      <span>Loading invoices…</span>
    </div>
  )

  if (fetchError) return (
    <div className="page">
      <div className="error-box">{fetchError}</div>
    </div>
  )

  // Summary counts for the stat cards at the top
  const totalInvoices = invoiceList.length
  const approvedCount = invoiceList.filter(inv => inv.status === "APPROVED").length
  const underReviewCount = invoiceList.filter(inv => inv.status === "REVIEW").length
  const onHoldCount = invoiceList.filter(inv => inv.status === "HOLD").length

  return (
    <div className="page animate-in">

      {/* Page header with a quick-create button */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice Dashboard</h1>
          <p className="page-subtitle">
            AI-powered supplier memory system — every decision is backed by historical context
          </p>
        </div>
        <Link to="/create" className="btn btn-primary">+ Create Invoice</Link>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card purple">
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{totalInvoices}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Approved</div>
          <div className="stat-value">{approvedCount}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Under Review</div>
          <div className="stat-value">{underReviewCount}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">On Hold (High Risk)</div>
          <div className="stat-value">{onHoldCount}</div>
        </div>
      </div>

      {/* ── Invoice table or empty state ──────────────────────────── */}
      {invoiceList.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: "3rem" }}>
          <p>
            No invoices yet.{" "}
            <Link to="/create" className="btn-link">Create your first invoice →</Link>
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Supplier</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.map(invoice => (
                <tr key={invoice.id}>
                  {/* Invoice ID shown in muted colour to not distract */}
                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                    #{invoice.id}
                  </td>

                  {/* Show supplier name if available, otherwise fall back to ID */}
                  <td style={{ fontWeight: 500 }}>
                    {invoice.supplier?.name || `Supplier #${invoice.supplierId}`}
                  </td>

                  <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    ₹{Number(invoice.amount).toLocaleString("en-IN")}
                  </td>

                  <td>
                    <span className={`badge ${STATUS_BADGE_CLASS[invoice.status] || "badge-pending"}`}>
                      {invoice.status}
                    </span>
                  </td>

                  <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  <td>
                    <Link to={`/invoice/${invoice.id}`} className="btn-link">
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Dashboard