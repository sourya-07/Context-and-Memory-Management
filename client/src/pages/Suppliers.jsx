import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getSuppliers, createSupplier } from "../services/api"

function Suppliers() {
    const [supplierList, setSupplierList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [fetchError, setFetchError] = useState(null)

    // Controls whether the "add supplier" form is visible
    const [showAddForm, setShowAddForm] = useState(false)
    const [newSupplierName, setNewSupplierName] = useState("")
    const [isSavingSupplier, setIsSavingSupplier] = useState(false)
    const [addSupplierError, setAddSupplierError] = useState(null)

    // Fetches the current supplier list from the server
    function fetchSuppliers() {
        setIsLoading(true)
        getSuppliers()
            .then(setSupplierList)
            .catch(() => setFetchError("Could not load suppliers. Please refresh."))
            .finally(() => setIsLoading(false))
    }

    // Load suppliers on first render
    useEffect(() => {
        fetchSuppliers()
    }, [])

    // Called when the user submits the "add supplier" form
    async function handleAddSupplier(e) {
        e.preventDefault()
        const trimmedName = newSupplierName.trim()
        if (!trimmedName) return  // don't allow blank names

        setIsSavingSupplier(true)
        setAddSupplierError(null)

        try {
            await createSupplier({ name: trimmedName })
            setNewSupplierName("")
            setShowAddForm(false)
            fetchSuppliers()  // reload the list to include the new one
        } catch {
            setAddSupplierError("Could not create the supplier. Please try again.")
        } finally {
            setIsSavingSupplier(false)
        }
    }

    if (isLoading) return (
        <div className="loader">
            <div className="spinner" />
            <span>Loading suppliers…</span>
        </div>
    )

    if (fetchError) return (
        <div className="page">
            <div className="error-box">{fetchError}</div>
        </div>
    )

    return (
        <div className="page animate-in">

            {/* Page header with toggle button for the add form */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Suppliers</h1>
                    <p className="page-subtitle">
                        Manage your suppliers and explore their AI memory profiles
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    {showAddForm ? "Cancel" : "+ Add Supplier"}
                </button>
            </div>

            {/* ── Inline "add supplier" form ─────────────────────────── */}
            {showAddForm && (
                <div className="form-card" style={{ marginBottom: "2rem", maxWidth: 480 }}>
                    <div className="section-title">New Supplier</div>

                    {addSupplierError && (
                        <div className="error-box" style={{ marginBottom: "1rem" }}>
                            {addSupplierError}
                        </div>
                    )}

                    <form onSubmit={handleAddSupplier} style={{ display: "flex", gap: "0.75rem" }}>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="e.g. Green Valley Farms"
                            value={newSupplierName}
                            onChange={e => setNewSupplierName(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSavingSupplier}
                            style={{ whiteSpace: "nowrap" }}
                        >
                            {isSavingSupplier ? "Saving…" : "Add"}
                        </button>
                    </form>
                </div>
            )}

            {/* ── Supplier list or empty state ──────────────────────── */}
            {supplierList.length === 0 ? (
                <div className="empty-state glass-card">
                    <p>No suppliers yet. Add one to get started.</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#ID</th>
                                <th>Name</th>
                                <th>Events Logged</th>
                                <th>Invoices</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supplierList.map(supplier => (
                                <tr key={supplier.id}>
                                    <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                                        #{supplier.id}
                                    </td>

                                    <td style={{ fontWeight: 700 }}>{supplier.name}</td>

                                    <td>
                                        {/* How many times something has happened with this supplier */}
                                        <span className="chip">
                                            {supplier._count?.events || 0} events
                                        </span>
                                    </td>

                                    <td>
                                        <span className="chip">
                                            {supplier._count?.invoices || 0} invoices
                                        </span>
                                    </td>

                                    <td style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                                        <Link to={`/suppliers/${supplier.id}`} className="btn-link">
                                            Memory Profile →
                                        </Link>
                                        <Link
                                            to={`/log-event?supplierId=${supplier.id}`}
                                            className="btn-link"
                                            style={{ color: "var(--color-teal)" }}
                                        >
                                            + Log Event
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

export default Suppliers
