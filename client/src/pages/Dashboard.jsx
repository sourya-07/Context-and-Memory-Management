import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getAllInvoices } from "../services/api"

function Dashboard() {

  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getAllInvoices()
        setInvoices(data)
      } catch (err) {
        console.error("Failed to fetch invoices:", err)
        setError("Failed to load invoices")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <h2 style={{ padding: "2rem" }}>Loading...</h2>
  if (error) return <h2 style={{ padding: "2rem", color: "red" }}>{error}</h2>

  const total = invoices.length
  const highRisk = invoices.filter(i => i.status === "HOLD").length

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Dashboard</h2>

      <div style={{ marginBottom: "1rem" }}>
        <p><strong>Total Invoices:</strong> {total}</p>
        <p><strong>High Risk:</strong> {highRisk}</p>
      </div>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ID</th>
            <th>Amount</th>
            <th>Status</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id}>
              <td>{inv.id}</td>
              <td>₹{inv.amount}</td>
              <td>{inv.status}</td>
              <td>
                <Link to={`/invoice/${inv.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Dashboard