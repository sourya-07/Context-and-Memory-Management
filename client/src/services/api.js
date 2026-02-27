// All network requests to the backend go through here.
// Every function is async and throws on failure, so callers can catch and show errors.

// The backend URL comes from the .env file (VITE_BACKEND_URL)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

//  Invoices

// Submit a new invoice for AI processing — returns invoiceId + decision
export async function createInvoice(invoiceData) {
  const response = await fetch(`${BACKEND_URL}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoiceData),
  })
  if (!response.ok) throw new Error("Failed to create invoice")
  return response.json()
}

// Get a single invoice with its AI decision and context layers
export async function getInvoice(invoiceId) {
  const response = await fetch(`${BACKEND_URL}/invoice/${invoiceId}`)
  if (!response.ok) throw new Error("Invoice not found")
  return response.json()
}

// Get all invoices — used on the dashboard table
export async function getAllInvoices() {
  const response = await fetch(`${BACKEND_URL}/invoice`)
  if (!response.ok) throw new Error("Failed to fetch invoices")
  return response.json()
}

// ── Suppliers ────────────────────────────────────────────────────────────────

// Get all suppliers with their event and invoice counts
export async function getSuppliers() {
  const response = await fetch(`${BACKEND_URL}/supplier`)
  if (!response.ok) throw new Error("Failed to fetch suppliers")
  return response.json()
}

// Create a brand new supplier
export async function createSupplier(supplierData) {
  const response = await fetch(`${BACKEND_URL}/supplier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(supplierData),
  })
  if (!response.ok) throw new Error("Failed to create supplier")
  return response.json()
}

// Get a supplier's full memory profile — includes events, invoices, and risk data
export async function getSupplierProfile(supplierId) {
  const response = await fetch(`${BACKEND_URL}/supplier/${supplierId}`)
  if (!response.ok) throw new Error("Supplier not found")
  return response.json()
}

// Get the full 4-layer AI context for a supplier (used on the memory profile page)
export async function getSupplierContext(supplierId) {
  const response = await fetch(`${BACKEND_URL}/supplier/${supplierId}/context`)
  if (!response.ok) throw new Error("Failed to build supplier context")
  return response.json()
}

// Events

// Log a new supplier event (quality issue, delivery delay, etc.)
export async function logEvent(eventData) {
  const response = await fetch(`${BACKEND_URL}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
  })
  if (!response.ok) throw new Error("Failed to log event")
  return response.json()
}

// Get all events logged for a specific supplier
export async function getSupplierEvents(supplierId) {
  const response = await fetch(`${BACKEND_URL}/event/supplier/${supplierId}`)
  if (!response.ok) throw new Error("Failed to fetch events for this supplier")
  return response.json()
}