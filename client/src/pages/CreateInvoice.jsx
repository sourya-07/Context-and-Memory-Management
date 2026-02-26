import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createInvoice } from "../services/api"

function CreateInvoice() {

  const [supplierId, setSupplierId] = useState("")
  const [amount, setAmount] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      const data = await createInvoice({
        supplierId: Number(supplierId),
        amount: Number(amount)
      })

      setResult(data)

      navigate(`/invoice/${data.invoiceId}`)

    } catch (error) {
      alert("Something went wrong")
    }

    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <h2>Create Invoice</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="number"
          placeholder="Supplier ID"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Submit"}
        </button>
      </form>

      {result && (
        <div style={styles.result}>
          <p><strong>Risk:</strong> {result.risk}</p>
          <p><strong>Recommendation:</strong> {result.recommendation}</p>
          <p><strong>Status:</strong> {result.status}</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    padding: "2rem"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxWidth: "300px"
  },
  result: {
    marginTop: "1rem",
    padding: "1rem",
    background: "#f4f4f4"
  }
}

export default CreateInvoice