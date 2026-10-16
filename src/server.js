require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");

const updateStockPrices = require("./services/priceGenerator");

const app = express();

app.use(express.json());

connectDB();

setInterval(async () => {
    await updateStockPrices();
}, 30000);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});