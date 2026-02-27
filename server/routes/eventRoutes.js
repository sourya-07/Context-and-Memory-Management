const express = require("express")
const { logEvent, getEventsBySupplier } = require("../controllers/eventController")

const router = express.Router()

router.post("/", logEvent)
router.get("/supplier/:id", getEventsBySupplier)

module.exports = router
