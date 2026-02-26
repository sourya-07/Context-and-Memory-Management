import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { getInvoice } from "../services/api"

function InvoiceDetails() {

  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const result = await getInvoice(id)
        setData(result)
      } catch (err) {
        setError("Invoice not found")
      }
      setLoading(false)
    }

    fetchInvoice()
  }, [id])

  if (loading) return <h2 style={{ padding: "2rem" }}>Loading...</h2>
  if (error) return <h2 style={{ padding: "2rem" }}>{error}</h2>

  const { invoice, decision } = data

  return (
    <div style={styles.container}>
      <h2>Invoice Details</h2>

      <div style={styles.card}>
        <p><strong>Invoice ID:</strong> {invoice.id}</p>
        <p><strong>Supplier ID:</strong> {invoice.supplierId}</p>
        <p><strong>Amount:</strong> ₹{invoice.amount}</p>
        <p><strong>Status:</strong> {invoice.status}</p>
        <p><strong>Created At:</strong> {new Date(invoice.createdAt).toLocaleString()}</p>
      </div>

      {decision && (
        <div style={styles.card}>
          <h3>Decision Info</h3>
          <p><strong>Risk Score:</strong> {decision.riskScore}</p>
          <p><strong>Explanation:</strong> {decision.explanation}</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: "2rem"
  },
  card: {
    background: "#f4f4f4",
    padding: "1rem",
    marginTop: "1rem",
    borderRadius: "8px"
  }
}

export default InvoiceDetails