require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const api = require("./routes/api");
const { authenticate, requireAdmin } = require("./middleware/auth");
const ensureDefaultStocks = require("./services/defaultStocks");
const {
    initializeMarketPrices,
    startPriceGenerator
} = require("./services/priceGenerator");
const path = require("path");

const app = express();

app.use(express.json());
app.use("/api", api);
app.get("/stock-management.html", authenticate, requireAdmin, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "private", "stock-management.html"));
});
app.use(express.static(path.join(__dirname, "site")));

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    return ensureDefaultStocks();
}).then(() => {
    return initializeMarketPrices();
}).then(() => {
    startPriceGenerator();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
