const Stock = require("../models/Stock");
const { processPendingLimitOrders } = require("./limitOrders");
const {
    currentMarketTime,
    getMarketSettings,
    isMarketOpen
} = require("./marketSchedule");

const PRICE_UPDATE_INTERVAL = 5 * 1000;
const PRICE_HISTORY_LIMIT = 60;
const DAILY_PRICE_LIMIT = 0.10;
const PRICE_VOLATILITY = 0.006;

function utcDate(date) {
    return date.toISOString().slice(0, 10);
}

function nextPrice(price, dayOpen, random = Math.random) {
    const fluctuation = (random() + random() + random() - 1.5) * PRICE_VOLATILITY;
    const lowerBound = Math.round(dayOpen * (1 - DAILY_PRICE_LIMIT) * 100) / 100;
    const upperBound = Math.round(dayOpen * (1 + DAILY_PRICE_LIMIT) * 100) / 100;
    const candidate = Math.round(price * (1 + fluctuation) * 100) / 100;
    return Math.min(upperBound, Math.max(lowerBound, candidate));
}

async function initializeMarketPrices(now = new Date()) {
    now = currentMarketTime(await getMarketSettings(), now);
    const date = utcDate(now);
    const stocks = await Stock.find();

    for (const stock of stocks) {
        const currentPrice = stock.market_price;
        if (!stock.market_date) {
            stock.previous_close = stock.initial_price;
            stock.day_open = currentPrice;
            stock.day_high = currentPrice;
            stock.day_low = currentPrice;
            stock.market_date = date;
            stock.price_history = [{ price: currentPrice, recorded_at: now }];
            await stock.save();
        } else if (stock.market_date !== date) {
            stock.previous_close = stock.market_price;
            stock.day_open = currentPrice;
            stock.day_high = currentPrice;
            stock.day_low = currentPrice;
            stock.market_date = date;
            stock.price_history = [{ price: currentPrice, recorded_at: now }];
            await stock.save();
        } else if (!stock.price_history.length) {
            stock.price_history.push({ price: currentPrice, recorded_at: now });
            await stock.save();
        }
    }
}

async function updateMarketPrices(now = new Date()) {
    const settings = await getMarketSettings();
    now = currentMarketTime(settings, now);
    if (!isMarketOpen(settings, now)) return;

    const date = utcDate(now);
    const stocks = await Stock.find();

    for (const stock of stocks) {
        const currentPrice = stock.market_price;
        const isNewDay = stock.market_date !== date;
        if (isNewDay) {
            stock.previous_close = currentPrice;
            stock.day_open = currentPrice;
            stock.day_high = currentPrice;
            stock.day_low = currentPrice;
            stock.market_date = date;
            stock.price_history = [];
        } else if (!Number.isFinite(stock.day_open) || stock.day_open <= 0) {
            stock.day_open = stock.initial_price;
        }

        const price = nextPrice(currentPrice, stock.day_open);
        stock.market_price = price;
        stock.day_high = Math.max(stock.day_high || price, price);
        stock.day_low = Math.min(stock.day_low || price, price);
        stock.price_history.push({ price, recorded_at: now });
        if (stock.price_history.length > PRICE_HISTORY_LIMIT) {
            stock.price_history.splice(0, stock.price_history.length - PRICE_HISTORY_LIMIT);
        }
        await stock.save();
    }
}

function startPriceGenerator() {
    const timer = setInterval(() => {
        updateMarketPrices()
            .then(() => processPendingLimitOrders())
            .catch((error) => {
                console.error("Market price update failed:", error);
            });
    }, PRICE_UPDATE_INTERVAL);
    timer.unref();
    return timer;
}

module.exports = {
    initializeMarketPrices,
    nextPrice,
    startPriceGenerator,
    updateMarketPrices
};