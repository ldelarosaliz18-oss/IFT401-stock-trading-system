const Stock = require("../models/Stock");
const User = require("../models/User");

const DEFAULT_STOCKS = [
    {
        symbol: "NVDA",
        company_name: "NVIDIA Corp.",
        initial_price: 128.20,
        market_price: 128.20,
        volume: 10000
    },
    {
        symbol: "AMD",
        company_name: "Advanced Micro Devices, Inc.",
        initial_price: 164.00,
        market_price: 164.00,
        volume: 10000
    }
];

async function ensureDefaultStocks(creatorId) {
    const creator = creatorId
        ? { _id: creatorId }
        : await User.findOne().sort({ createdAt: 1 }).select("_id").lean();
    if (!creator) return;

    await Stock.bulkWrite(
        DEFAULT_STOCKS.map((stock) => ({
            updateOne: {
                filter: { symbol: stock.symbol },
                update: {
                    $setOnInsert: {
                        ...stock,
                        created_by: creator._id
                    }
                },
                upsert: true
            }
        }))
    );
}

module.exports = ensureDefaultStocks;
