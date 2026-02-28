import { useEffect, useState } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { getSuppliers, logEvent } from "../services/api"

// These are the kinds of things that happen with suppliers in real businesses.
// Each one becomes a "memory" the AI agent can learn from later.
const SUPPLIER_EVENT_TYPES = [
    "quality_issue",
    "logistics_delay",
    "payment_dispute",
    "seasonal_pattern",
    "contract_breach",
    "delivery_damage",
    "communication_issue",
    "pricing_discrepancy",
]

// Explains how each memory type behaves over time.
// Fresh = recent and impactful. Stale = older, less weight. Evergreen = never expires.
const MEMORY_LIFECYCLE_GUIDE = [
    {
        badge: "badge-fresh",
        label: "Fresh",
        description: "Less than 12 months old — carries full weight when making decisions",
    },
    {
        badge: "badge-stale",
        label: "Stale",
        description: "12–24 months old — still considered, but less influential",
    },
    {
        badge: "badge-archived",
        label: "Archived",
        description: "Older than 24 months — kept for reference, minimal influence",
    },
    {
        badge: "badge-evergreen",
        label: "Evergreen",
        description: "Never decays — used for things like contract terms or compliance issues",
    },
]

// How the AI scores relevance of a memory when making a decision.
const RELEVANCE_FORMULA = `relevance =
  0.4 × severity
+ 0.3 × decay_factor
+ 0.2 × normalized_cost
+ 0.1 × confidence

decay = e^(-0.2 × months_since_event)
(evergreen memories always have decay = 1.0)`

function LogEvent() {
    const [urlParams] = useSearchParams()
    const navigate = useNavigate()

    // Supplier list from the server
    const [suppliers, setSuppliers] = useState([])
    const [isFetchingSuppliers, setIsFetchingSuppliers] = useState(true)

    // --- Form field state ---
    // Pre-fill the supplier if it was passed in the URL (e.g. from the Supplier page)
    const [selectedSupplierId, setSelectedSupplierId] = useState(urlParams.get("supplierId") || "")
    const [eventType, setEventType] = useState("quality_issue")
    // Severity is a 0–1 scale; 0.5 is a moderate issue
    const [severity, setSeverity] = useState(0.5)
    const [financialImpact, setFinancialImpact] = useState("")
    // Confidence means: how sure are we this event is accurate / reliable?
    const [confidence, setConfidence] = useState(0.8)
    const [notes, setNotes] = useState("")
    // "time_sensitive" events decay over time. "evergreen" events never lose weight.
    const [memoryType, setMemoryType] = useState("time_sensitive")

    // --- UI state ---
    const [isSaving, setIsSaving] = useState(false)
    const [savedEvent, setSavedEvent] = useState(null)
    const [errorMessage, setErrorMessage] = useState(null)

    // Load all suppliers on mount so user can pick one
    useEffect(() => {
        getSuppliers()
            .then(setSuppliers)
            .catch(() => {
                // If suppliers fail to load, the page still works — user just won't see the list
            })
            .finally(() => setIsFetchingSuppliers(false))
    }, [])

    // Called when the user submits the form
    async function saveEvent(e) {
        e.preventDefault()
        setIsSaving(true)
        setErrorMessage(null)

        try {
            const response = await logEvent({
                supplierId: Number(selectedSupplierId),
                type: eventType,
                severity: parseFloat(severity),
                impactCost: parseFloat(financialImpact),
                confidence: parseFloat(confidence),
                description: notes.trim() || null,  // null if blank
                memoryTag: memoryType,
            })
            // Show the success screen with the saved event summary
            setSavedEvent(response)
        } catch {
            setErrorMessage("Something went wrong while saving the event. Double-check all fields and try again.")
        } finally {
            setIsSaving(false)
        }
    }

    // Let the user log another event without leaving the page
    function startFresh() {
        setEventType("quality_issue")
        setSeverity(0.5)
        setFinancialImpact("")
        setConfidence(0.8)
        setNotes("")
        setMemoryType("time_sensitive")
        setSavedEvent(null)
    }

    // ─── Success Screen ──────────────────────────────────────────────────────
    // After saving, show a confirmation card with what was logged
    if (savedEvent) {
        const logged = savedEvent.event
        const isEvergreen = logged.memoryTag === "evergreen"

        return (
            <div className="page animate-in">
                <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", paddingTop: "3rem" }}>

                    <h2 style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                        color: "#059669",  // green to match success feel
                    }}>
                        Event Logged Successfully
                    </h2>

                    <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "0.9rem" }}>
                        This supplier's memory cache has been cleared. The AI will include this event
                        the next time it makes a decision for this supplier.
                    </p>

                    {/* Summary card showing what was recorded */}
                    <div className="glass-card" style={{ padding: "1.5rem", textAlign: "left", marginBottom: "1.5rem" }}>
                        <div className="context-kv">
                            <span className="context-key">Event ID</span>
                            <span className="context-val">#{logged.id}</span>

                            <span className="context-key">Type</span>
                            <span className="context-val">{logged.type.replace(/_/g, " ")}</span>

                            <span className="context-key">Severity</span>
                            <span className="context-val">{logged.severity}</span>

                            <span className="context-key">Financial Impact</span>
                            <span className="context-val">₹{Number(logged.impactCost).toLocaleString("en-IN")}</span>

                            <span className="context-key">Memory Type</span>
                            <span className="context-val">
                                <span className={`badge ${isEvergreen ? "badge-evergreen" : "badge-fresh"}`}>
                                    {isEvergreen ? "Evergreen" : "Time Sensitive"}
                                </span>
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                        <Link to={`/suppliers/${selectedSupplierId}`} className="btn btn-primary">
                            View Supplier Memory Profile →
                        </Link>
                        <button className="btn btn-ghost" onClick={startFresh}>
                            Log Another Event
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Main Form ───────────────────────────────────────────────────────────
    return (
        <div className="page animate-in">

            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Log an Event</h1>
                    <p className="page-subtitle">
                        Record something that happened with a supplier — good or bad. This becomes part of their memory.
                    </p>
                </div>
                <Link to="/suppliers" className="btn btn-ghost">← Back to Suppliers</Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>

                {/* ── Event Details Form ─────────────────────────────────── */}
                <div className="form-card">
                    <div className="section-title">Event Details</div>

                    {errorMessage && (
                        <div className="error-box" style={{ marginBottom: "1rem" }}>{errorMessage}</div>
                    )}

                    <form onSubmit={saveEvent} className="form-grid">

                        {/* Which supplier did this happen with? */}
                        <div className="form-group">
                            <label className="form-label">Supplier</label>
                            <select
                                className="form-select"
                                value={selectedSupplierId}
                                onChange={e => setSelectedSupplierId(e.target.value)}
                                required
                            >
                                <option value="">Choose a supplier…</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name} (#{supplier.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* What kind of event was it? */}
                        <div className="form-group">
                            <label className="form-label">Event Type</label>
                            <select
                                className="form-select"
                                value={eventType}
                                onChange={e => setEventType(e.target.value)}
                            >
                                {SUPPLIER_EVENT_TYPES.map(type => (
                                    <option key={type} value={type}>
                                        {type.replace(/_/g, " ")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* How bad was it, on a scale of 0 to 1? */}
                        <div className="form-group">
                            <label className="form-label">Severity — {severity} / 1.0</label>
                            <input
                                type="range"
                                className="form-range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={severity}
                                onChange={e => setSeverity(e.target.value)}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                <span>Minor</span>
                                <span>Moderate</span>
                                <span>Critical</span>
                            </div>
                        </div>

                        {/* How much money was lost or at risk? */}
                        <div className="form-group">
                            <label className="form-label">Financial Impact (₹)</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="e.g. 50000"
                                value={financialImpact}
                                onChange={e => setFinancialImpact(e.target.value)}
                                min="0"
                                required
                            />
                        </div>

                        {/* How confident are we that this data is accurate? */}
                        <div className="form-group">
                            <label className="form-label">Confidence in this data — {confidence} / 1.0</label>
                            <input
                                type="range"
                                className="form-range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={confidence}
                                onChange={e => setConfidence(e.target.value)}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                <span>Low confidence</span>
                                <span>High confidence</span>
                            </div>
                        </div>

                        {/* Optional free-text description for more context */}
                        <div className="form-group">
                            <label className="form-label">Notes (optional)</label>
                            <textarea
                                className="form-textarea"
                                placeholder='Describe what happened, e.g. "30% of goods arrived damaged due to packaging failure"'
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {/* Should this memory expire over time or stay forever? */}
                        <div className="form-group">
                            <label className="form-label">Memory Behaviour</label>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                {/* Time Sensitive: this gets less important as time passes */}
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() => setMemoryType("time_sensitive")}
                                    style={{
                                        flex: 1,
                                        border: `1px solid ${memoryType === "time_sensitive" ? "var(--color-teal)" : "var(--border)"}`,
                                        background: memoryType === "time_sensitive" ? "rgba(168, 218, 220, 0.15)" : "transparent",
                                        color: memoryType === "time_sensitive" ? "#0d5c63" : "var(--text-muted)",
                                        fontSize: "0.85rem",
                                        fontWeight: memoryType === "time_sensitive" ? 600 : 400,
                                    }}
                                >
                                    Time Sensitive
                                </button>

                                {/* Evergreen: always matters, regardless of how old it is */}
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() => setMemoryType("evergreen")}
                                    style={{
                                        flex: 1,
                                        border: `1px solid ${memoryType === "evergreen" ? "var(--color-navy)" : "var(--border)"}`,
                                        background: memoryType === "evergreen" ? "rgba(27, 38, 59, 0.08)" : "transparent",
                                        color: memoryType === "evergreen" ? "var(--color-navy)" : "var(--text-muted)",
                                        fontSize: "0.85rem",
                                        fontWeight: memoryType === "evergreen" ? 600 : 400,
                                    }}
                                >
                                    Evergreen
                                </button>
                            </div>

                            {/* Short hint explaining the choice */}
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                                {memoryType === "evergreen"
                                    ? "This memory will always count at full weight — ideal for contract violations, compliance issues, or fixed patterns."
                                    : "This memory will gradually lose influence as it gets older — good for one-time incidents."}
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSaving || isFetchingSuppliers}
                            style={{ marginTop: "0.25rem" }}
                        >
                            {isSaving ? "Saving event…" : "Save Event to Memory"}
                        </button>

                    </form>
                </div>

                {/* ── Sidebar: Help & Reference */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                    {/* Memory type guide */}
                    <div className="glass-card" style={{ padding: "1.5rem" }}>
                        <div className="section-title">Memory Lifecycle</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                            {MEMORY_LIFECYCLE_GUIDE.map(item => (
                                <div key={item.label} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                    <span className={`badge ${item.badge}`} style={{ marginTop: "0.1rem", whiteSpace: "nowrap" }}>
                                        {item.label}
                                    </span>
                                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                        {item.description}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Formula reference for how relevance is calculated */}
                    <div className="glass-card" style={{ padding: "1.5rem" }}>
                        <div className="section-title">How Relevance is Scored</div>
                        <div className="explanation-box" style={{ fontSize: "0.78rem" }}>
                            {RELEVANCE_FORMULA}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default LogEvent
