const express = require("express")
const { createInvoice, fetchInvoice } = require("../controllers/invoiceController")

const router = express.Router()

router.post("/", createInvoice)
router.get("/:id", fetchInvoice)

module.exports = router