import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getInvoice } from "../services/api"

// Maps invoice status → badge CSS class
const STATUS_BADGE_CLASS = {
  APPROVED: "badge-approved",
  HOLD: "badge-hold",
  REVIEW: "badge-review",
  PENDING: "badge-pending",
}

// Maps memory lifecycle stage → badge CSS class
const MEMORY_BADGE_CLASS = {
  fresh: "badge-fresh",
  stale: "badge-stale",
  archived: "badge-archived",
  evergreen: "badge-evergreen",
}

function InvoiceDetails() {
  const { id } = useParams()

  // The combined object returned by the API: { invoice, decision, context }
  const [invoiceData, setInvoiceData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Load the invoice + its AI decision when the page opens
  useEffect(() => {
    getInvoice(id)
      .then(setInvoiceData)
      .catch(() => setFetchError("Invoice not found. It may have been deleted."))
      .finally(() => setIsLoading(false))
  }, [id])

  if (isLoading) return (
    <div className="loader">
      <div className="spinner" />
      <span>Loading invoice context…</span>
    </div>
  )

  if (fetchError) return (
    <div className="page">
      <div className="error-box">{fetchError}</div>
    </div>
  )

  const { invoice, decision, context } = invoiceData

  // Risk score drives the colour coding throughout this page
  const riskScore = decision?.riskScore || 0
  const riskCssClass = riskScore > 0.6 ? "risk-high" : riskScore > 0.3 ? "risk-mid" : "risk-low"
  const riskLabel = riskScore > 0.6 ? "HIGH RISK" : riskScore > 0.3 ? "MODERATE RISK" : "LOW RISK"

  return (
    <div className="page animate-in">

      {/* Page header = */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice #{invoice.id}</h1>
          <p className="page-subtitle">
            {invoice.supplier?.name || `Supplier #${invoice.supplierId}`}
            {" — "}
            {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">← Dashboard</Link>
      </div>

      {/* Top row: invoice basics + risk gauge */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>

        {/* Invoice summary card */}
        <div className="glass-card" style={{ padding: "1.5rem" }}>
          <div className="section-title">Invoice Summary</div>
          <div className="context-kv">
            <span className="context-key">Amount</span>
            <span className="context-val" style={{ fontSize: "1.4rem", fontWeight: 800 }}>
              ₹{Number(invoice.amount).toLocaleString("en-IN")}
            </span>

            <span className="context-key">Decision Status</span>
            <span className="context-val">
              <span className={`badge ${STATUS_BADGE_CLASS[invoice.status] || "badge-pending"}`}>
                {invoice.status}
              </span>
            </span>

            <span className="context-key">Supplier</span>
            <span className="context-val">
              {invoice.supplier?.name || `#${invoice.supplierId}`}
            </span>

            <span className="context-key">Processed On</span>
            <span className="context-val">
              {new Date(invoice.createdAt).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Risk assessment card — only shown if a decision exists */}
        {decision && (
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <div className="section-title">AI Risk Assessment</div>
            <div className="risk-gauge">
              <div>
                <div className={`risk-score-num ${riskCssClass}`}>
                  {riskScore.toFixed(3)}
                </div>
                <div className="risk-label">{riskLabel}</div>
              </div>

              <div style={{ flex: 1 }}>
                {/* Risk bar — fills proportionally to score */}
                <div style={{
                  background: "var(--border)", height: 8,
                  borderRadius: 999, overflow: "hidden", marginBottom: "0.75rem",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${(riskScore * 100).toFixed(1)}%`,
                    background: riskScore > 0.6
                      ? "var(--grad-danger)"
                      : riskScore > 0.3
                        ? "linear-gradient(135deg,#f59e0b,#f97316)"
                        : "var(--grad-success)",
                    borderRadius: 999,
                    transition: "width 0.8s ease",
                  }} />
                </div>

                {/* Plain-English recommendation from the AI */}
                <div className="risk-rec">
                  {context?.experientialContext?.recommendation}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* The 4 AI Context Layers */}
      {context && (
        <>
          {/* Layer 1 — What's happening right now */}
          <div className="section">
            <div className="section-title">Layer 1 — Immediate Context</div>
            <div className="context-layer immediate">
              <div className="context-layer-title">Current Transaction</div>
              <div className="context-kv">
                <span className="context-key">Supplier</span>
                <span className="context-val">{context.immediateContext.supplierName}</span>

                <span className="context-key">Invoice Amount</span>
                <span className="context-val">
                  ₹{Number(context.immediateContext.invoiceAmount).toLocaleString("en-IN")}
                </span>

                <span className="context-key">Risk Score</span>
                <span className="context-val">{context.immediateContext.currentRiskScore}</span>

                <span className="context-key">Processed At</span>
                <span className="context-val">
                  {new Date(context.immediateContext.processingDate).toLocaleString("en-IN")}
                </span>

                {/* Was the context served from cache or freshly computed? */}
                {context.cacheHit !== undefined && (
                  <>
                    <span className="context-key">Context Source</span>
                    <span className="context-val">
                      <span className="chip">
                        {context.cacheHit ? "Redis Cache Hit" : "Freshly Computed"}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Layer 2 — Recent events (< 12 months), highest influence */}
          <div className="section">
            <div className="section-title">Layer 2 — Historical Context</div>
            {context.historicalContext.freshEventCount === 0 ? (
              <div className="empty-state glass-card">
                <p>No recent events (under 12 months) found for this supplier.</p>
              </div>
            ) : (
              context.historicalContext.topMemories.map(event => (
                <div key={event.id} className="event-card">
                  <div className="event-header">
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="event-type">{event.type.replace(/_/g, " ")}</span>
                      <span className={`badge ${MEMORY_BADGE_CLASS[event.memoryStatus] || "badge-pending"}`}>
                        {event.memoryStatus}
                      </span>
                      {/* Show an extra evergreen badge if applicable */}
                      {event.memoryTag === "evergreen" && (
                        <span className="badge badge-evergreen">evergreen</span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {event.ageMonths}mo ago
                    </span>
                  </div>

                  <div className="event-meta">
                    <span className="chip">Severity {event.severity}/1</span>
                    <span className="chip">₹{Number(event.impactCost).toLocaleString("en-IN")} impact</span>
                    <span className="chip">Relevance {event.relevanceScore}</span>
                  </div>

                  {/* Visual severity bar */}
                  <div className="severity-bar-wrap">
                    <div className="severity-bar-track">
                      <div className="severity-bar-fill" style={{ width: `${event.severity * 100}%` }} />
                    </div>
                    <span className="severity-label">Severity</span>
                  </div>

                  {/* Optional human-written note about the event */}
                  {event.description && (
                    <div className="event-desc">"{event.description}"</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Layer 3 — Older events + seasonal patterns */}
          <div className="section">
            <div className="section-title">Layer 3 — Temporal Context</div>
            <div className="context-layer temporal">
              <div className="context-layer-title">Staleness &amp; Seasonal Patterns</div>

              {/* Seasonal pattern warnings (e.g. monsoon delivery issues) */}
              {context.temporalContext.seasonalPatterns.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  {context.temporalContext.seasonalPatterns.map((pattern, index) => (
                    <div key={index} className="seasonal-tag">{pattern}</div>
                  ))}
                </div>
              )}

              <div className="context-kv" style={{ marginBottom: "0.75rem" }}>
                <span className="context-key">Stale Events</span>
                <span className="context-val">
                  {context.temporalContext.staleEventCount} (12–24 months, downweighted)
                </span>

                <span className="context-key">Archived Events</span>
                <span className="context-val">
                  {context.temporalContext.archivedEventCount} (&gt;24 months, minimal influence)
                </span>

                <span className="context-key">Staleness Note</span>
                <span className="context-val" style={{ color: "var(--accent-yellow)" }}>
                  {context.temporalContext.stalenessNote}
                </span>
              </div>

              {/* List of individual stale events */}
              {context.temporalContext.staleEvents.length > 0 && (
                <div>
                  <div style={{
                    fontSize: "0.72rem", color: "var(--text-muted)",
                    marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    Stale Events (reduced weight)
                  </div>
                  {context.temporalContext.staleEvents.map(e => (
                    <div key={e.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.5rem 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem",
                    }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                        {e.type.replace(/_/g, " ")}
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <span className="badge badge-stale">stale</span>
                        <span className="chip">{e.ageMonths}mo old</span>
                        <span className="chip">decay {e.decayFactor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Layer 4 — What we've learned about this supplier over all time */}
          <div className="section">
            <div className="section-title">Layer 4 — Experiential Context</div>
            <div className="context-layer experiential">
              <div className="context-layer-title">Aggregate Learnings</div>

              {/* Summary stat tiles */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginBottom: "1rem",
              }}>
                <div style={{ textAlign: "center", padding: "1rem", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-red)" }}>
                    ₹{Number(context.experientialContext.totalDocumentedLoss).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", textTransform: "uppercase" }}>
                    Total Documented Loss
                  </div>
                </div>

                <div style={{ textAlign: "center", padding: "1rem", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-yellow)" }}>
                    {(context.experientialContext.averageSeverity * 10).toFixed(1)}/10
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem", textTransform: "uppercase" }}>
                    Average Severity
                  </div>
                </div>

                <div style={{ textAlign: "center", padding: "1rem", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ marginTop: "0.25rem" }}>
                    <span className={`trend-pill trend-${context.experientialContext.trend.direction}`}>
                      {context.experientialContext.trend.direction === "improving" ? "↑"
                        : context.experientialContext.trend.direction === "deteriorating" ? "↓"
                          : "→"}{" "}
                      {context.experientialContext.trend.direction.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.5rem", textTransform: "uppercase" }}>
                    Performance Trend
                  </div>
                </div>
              </div>

              {/* Which types of events keep occurring? */}
              {Object.keys(context.experientialContext.eventTypeBreakdown).length > 0 && (
                <div>
                  <div style={{
                    fontSize: "0.72rem", color: "var(--text-muted)",
                    marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    Event Type Breakdown
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {Object.entries(context.experientialContext.eventTypeBreakdown).map(([type, count]) => (
                      <span key={type} className="chip" style={{ fontSize: "0.78rem" }}>
                        {type.replace(/_/g, " ")} × {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full AI decision explanation text (shown as a code-style block) */}
          {decision?.explanation && (
            <div className="section">
              <div className="section-title">AI Decision Explanation</div>
              <div className="explanation-box">{decision.explanation}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default InvoiceDetails