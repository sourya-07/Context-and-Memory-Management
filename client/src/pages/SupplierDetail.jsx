import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getSupplierProfile, getSupplierContext } from "../services/api"

// Maps a memory lifecycle stage to its badge CSS class
const MEMORY_BADGE_CLASS = {
    fresh: "badge-fresh",
    stale: "badge-stale",
    archived: "badge-archived",
    evergreen: "badge-evergreen",
}

function SupplierDetail() {
    const { id } = useParams()

    // Profile includes supplier info + all logged events + risk data
    const [supplierProfile, setSupplierProfile] = useState(null)
    // Context is the full 4-layer AI breakdown (optional — loaded in parallel)
    const [aiContext, setAiContext] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [fetchError, setFetchError] = useState(null)

    // Load both the supplier profile and AI context at the same time to save time
    useEffect(() => {
        Promise.all([
            getSupplierProfile(id),
            getSupplierContext(id),
        ])
            .then(([profile, context]) => {
                setSupplierProfile(profile)
                setAiContext(context)
            })
            .catch(() => setFetchError("Could not load the supplier's memory profile."))
            .finally(() => setIsLoading(false))
    }, [id])

    if (isLoading) return (
        <div className="loader">
            <div className="spinner" />
            <span>Building memory profile…</span>
        </div>
    )

    if (fetchError) return (
        <div className="page">
            <div className="error-box">{fetchError}</div>
        </div>
    )

    const { supplier, memories, riskData } = supplierProfile
    const riskScore = riskData.riskScore
    const riskClass = riskScore > 0.6 ? "risk-high" : riskScore > 0.3 ? "risk-mid" : "risk-low"
    const riskLabel = riskScore > 0.6 ? "HIGH RISK" : riskScore > 0.3 ? "MODERATE RISK" : "LOW RISK"

    return (
        <div className="page animate-in">

            {/* ── Page header ──────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">{supplier.name}</h1>
                    <p className="page-subtitle">Memory Profile — Supplier #{supplier.id}</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <Link to={`/log-event?supplierId=${id}`} className="btn btn-primary">
                        + Log Event
                    </Link>
                    <Link to="/suppliers" className="btn btn-ghost">← Suppliers</Link>
                </div>
            </div>

            {/* ── Summary stat cards ────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                {/* Risk score — colour coded to severity */}
                <div className="stat-card red">
                    <div className="stat-label">Risk Score</div>
                    <div className={`stat-value ${riskClass}`} style={{ fontSize: "1.6rem" }}>
                        {riskScore.toFixed(3)}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        {riskLabel}
                    </div>
                </div>

                <div className="stat-card purple">
                    <div className="stat-label">Total Events</div>
                    <div className="stat-value">{memories.totalEvents}</div>
                </div>

                {/* Fresh = under 12 months — these have the most weight in decisions */}
                <div className="stat-card green">
                    <div className="stat-label">Fresh Memories</div>
                    <div className="stat-value" style={{ color: "var(--accent-green)" }}>
                        {memories.fresh.length}
                    </div>
                </div>

                {/* Stale + archived combined — older, less influential */}
                <div className="stat-card blue">
                    <div className="stat-label">Stale / Archived</div>
                    <div className="stat-value" style={{ color: "var(--accent-blue)" }}>
                        {memories.stale.length + memories.archived.length}
                    </div>
                </div>
            </div>

            {/* ── Experiential summary from AI context ──────────────────── */}
            {aiContext && (
                <div className="section">
                    <div className="section-title">Experiential Knowledge</div>
                    <div className="glass-card" style={{ padding: "1.5rem" }}>

                        {/* Three headline numbers: total loss, avg severity, trend direction */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: "1rem",
                            marginBottom: "1.25rem",
                        }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-red)" }}>
                                    ₹{Number(aiContext.experientialContext.totalDocumentedLoss).toLocaleString("en-IN")}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Total Documented Loss
                                </div>
                            </div>

                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-yellow)" }}>
                                    {(aiContext.experientialContext.averageSeverity * 10).toFixed(1)}/10
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Average Severity
                                </div>
                            </div>

                            {/* Performance trend — improving / stable / deteriorating */}
                            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                                <span className={`trend-pill trend-${aiContext.experientialContext.trend.direction}`}>
                                    {aiContext.experientialContext.trend.direction === "improving" ? "↑"
                                        : aiContext.experientialContext.trend.direction === "deteriorating" ? "↓"
                                            : "→"}{" "}
                                    {aiContext.experientialContext.trend.direction.replace(/_/g, " ")}
                                </span>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Performance Trend
                                </div>
                            </div>
                        </div>

                        {/* What types of problems keep occurring? */}
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Event Types
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {Object.entries(aiContext.experientialContext.eventTypeBreakdown).map(([type, count]) => (
                                <span key={type} className="chip">{type.replace(/_/g, " ")} × {count}</span>
                            ))}
                        </div>

                        {/* Seasonal patterns — only shown if any were detected */}
                        {aiContext.temporalContext.seasonalPatterns.length > 0 && (
                            <div style={{ marginTop: "1rem" }}>
                                {aiContext.temporalContext.seasonalPatterns.map((pattern, index) => (
                                    <div key={index} className="seasonal-tag">{pattern}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Full memory timeline, ranked by relevance ─────────────── */}
            <div className="section">
                <div className="section-title">Memory Timeline (Ranked by Relevance)</div>

                {memories.ranked.length === 0 ? (
                    <div className="empty-state glass-card">
                        <p>No events logged yet for this supplier.</p>
                        <Link
                            to={`/log-event?supplierId=${id}`}
                            className="btn-link"
                            style={{ display: "inline-block", marginTop: "0.5rem" }}
                        >
                            Log first event →
                        </Link>
                    </div>
                ) : (
                    memories.ranked.map((event, rankIndex) => (
                        <div key={event.id} className="event-card">
                            <div className="event-header">
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                    {/* Rank number — #1 is the most relevant */}
                                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                        #{rankIndex + 1}
                                    </span>
                                    <span className="event-type">{event.type.replace(/_/g, " ")}</span>
                                    <span className={`badge ${MEMORY_BADGE_CLASS[event.memoryStatus] || "badge-pending"}`}>
                                        {event.memoryStatus}
                                    </span>
                                    {event.memoryTag === "evergreen" && (
                                        <span className="badge badge-evergreen">evergreen</span>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                    <span className="chip">relevance {event.relevanceScore}</span>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        {event.ageMonths}mo ago
                                    </span>
                                </div>
                            </div>

                            {/* Key metrics for this event */}
                            <div className="event-meta">
                                <span className="chip">Severity {event.severity}/1</span>
                                <span className="chip">₹{Number(event.impactCost).toLocaleString("en-IN")} impact</span>
                                <span className="chip">decay {event.decayFactor}</span>
                                <span className="chip">confidence {event.confidence}</span>
                            </div>

                            {/* Visual severity bar — wider = more severe */}
                            <div className="severity-bar-wrap">
                                <div className="severity-bar-track">
                                    <div className="severity-bar-fill" style={{ width: `${event.severity * 100}%` }} />
                                </div>
                                <span className="severity-label">{(event.severity * 10).toFixed(1)}/10</span>
                            </div>

                            {/* Optional human-written note */}
                            {event.description && (
                                <div className="event-desc">"{event.description}"</div>
                            )}

                            {/* Staleness note — warns user this event carries less weight */}
                            {(event.memoryStatus === "stale" || event.memoryStatus === "archived") && (
                                <div style={{
                                    marginTop: "0.5rem", fontSize: "0.75rem",
                                    color: "var(--text-muted)", fontStyle: "italic",
                                }}>
                                    {event.memoryStatus === "archived"
                                        ? "Archived — over 24 months old. Minimal influence on today's risk score."
                                        : "Stale — 12–24 months old. Downweighted in risk calculations."}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Recent invoices table ─────────────────────────────────── */}
            {supplier.invoices && supplier.invoices.length > 0 && (
                <div className="section">
                    <div className="section-title">Recent Invoices</div>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#ID</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {supplier.invoices.map(invoice => (
                                    <tr key={invoice.id}>
                                        <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                                            #{invoice.id}
                                        </td>
                                        <td style={{ fontWeight: 700 }}>
                                            ₹{Number(invoice.amount).toLocaleString("en-IN")}
                                        </td>
                                        <td>
                                            <span className={`badge ${invoice.status === "APPROVED" ? "badge-approved"
                                                    : invoice.status === "HOLD" ? "badge-hold"
                                                        : "badge-review"
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                            {new Date(invoice.createdAt).toLocaleDateString("en-IN")}
                                        </td>
                                        <td>
                                            <Link to={`/invoice/${invoice.id}`} className="btn-link">
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SupplierDetail
