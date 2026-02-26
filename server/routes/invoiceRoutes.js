const express = require("express")
const { createInvoice, fetchInvoice, fetchAllInvoices } = require("../controllers/invoiceController")

const router = express.Router()

router.get("/", fetchAllInvoices)
router.post("/", createInvoice)
router.get("/:id", fetchInvoice)

module.exports = router