const express = require("express")
const prisma = require("./config/prisma")
const dotenv = require("dotenv")
const invoiceRoutes = require("./routes/invoiceRoutes")

const app = express()
const port = process.env.PORT || 5080
dotenv.config()
app.use(express.json())


app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.use("/invoice", invoiceRoutes)


app.listen(port, () => {
    console.log(`Server started on port ${port}`)
})