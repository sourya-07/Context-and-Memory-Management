const express = require("express")
const dotenv = require("dotenv")
const invoiceRoutes = require("./routes/invoiceRoutes")
const { connectRedis } = require("./config/redis")

dotenv.config()

const app = express()
const port = process.env.PORT || 5080

app.use(express.json())

app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.use("/invoice", invoiceRoutes)

async function startServer() {
    await connectRedis()
    app.listen(port, () => {
        console.log(`Server started on port ${port}`)
    })
}

startServer()