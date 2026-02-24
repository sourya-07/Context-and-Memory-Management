import { useParams } from "react-router-dom"

export default function InvoiceDetails() {
  const { id } = useParams()

  return <h1>Invoice Details: {id}</h1>
}