const Stock = require("../models/Stock");

async function updateStockPrices() {
    try {
        const stocks = await Stock.find();

        for (const stock of stocks) {
            const changePercent = (Math.random() * 10 - 5) / 100;

            stock.market_price = Number(
                (stock.market_price * (1 + changePercent)).toFixed(2)
            );

            await stock.save();
        }

        console.log("Stock prices updated");
    } catch (error) {
        console.error("Price generator error:", error);
    }
}

module.exports = updateStockPrices;