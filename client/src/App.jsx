import { Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"
import Dashboard from "./pages/Dashboard"
import CreateInvoice from "./pages/CreateInvoice"
import InvoiceDetails from "./pages/InvoiceDetails"
import Suppliers from "./pages/Suppliers"
import SupplierDetail from "./pages/SupplierDetail"
import LogEvent from "./pages/LogEvent"

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateInvoice />} />
        <Route path="/invoice/:id" element={<InvoiceDetails />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/log-event" element={<LogEvent />} />
      </Routes>
    </>
  )
}

export default App