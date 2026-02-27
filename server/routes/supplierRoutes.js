const express = require("express")
const {
    listSuppliers,
    getSupplier,
    getSupplierContext,
    createSupplier,
} = require("../controllers/supplierController")

const router = express.Router()

router.get("/", listSuppliers)
router.post("/", createSupplier)
router.get("/:id", getSupplier)
router.get("/:id/context", getSupplierContext)

module.exports = router
