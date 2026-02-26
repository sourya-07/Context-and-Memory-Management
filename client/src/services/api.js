const BASE_URL = import.meta.env.VITE_BACKEND_URL

export async function createInvoice(data) {
  const response = await fetch(`${BASE_URL}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error("Failed to create invoice")
  }

  return response.json()
}

export async function getInvoice(id) {
  const response = await fetch(`${BASE_URL}/invoice/${id}`)

  if (!response.ok) {
    throw new Error("Invoice not found")
  }

  return response.json()
}


export async function getAllInvoices() {
  const response = await fetch(`${BASE_URL}/invoice`)

  if (!response.ok) {
    throw new Error("Failed to fetch invoices")
  }

  return response.json()
}