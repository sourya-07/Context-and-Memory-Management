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

async function startServer() {
    await connectRedis()
    app.listen(port, () => {
        console.log(`Server started on port ${port}`)
    })
}

startServer()