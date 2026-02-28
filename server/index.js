const express = require("express")
const dotenv = require("dotenv")
const invoiceRoutes = require("./routes/invoiceRoutes")
const supplierRoutes = require("./routes/supplierRoutes")
const eventRoutes = require("./routes/eventRoutes")
const { connectRedis } = require("./config/redis")
const cors = require("cors")

dotenv.config()

const app = express()
const port = process.env.PORT || 5080

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
    res.send("Context & Memory Management API — running")
})

app.use("/invoice", invoiceRoutes)
app.use("/supplier", supplierRoutes)
app.use("/event", eventRoutes)

// On Vercel (serverless), we just export the app.
// Vercel calls it as a function for each request — no persistent server process.
// Locally we still start a regular server with app.listen().
if (!process.env.VERCEL) {
    async function startServer() {
        await connectRedis()
        app.listen(port, () => {
            console.log(`Server started on port ${port}`)
        })
    }
    startServer()
} else {
    // On Vercel: attempt Redis connection but don't block startup if it fails
    connectRedis().catch(err => {
        console.warn("Redis connection skipped on startup:", err.message)
    })
}

// Export for Vercel serverless — this is what Vercel calls
module.exports = app