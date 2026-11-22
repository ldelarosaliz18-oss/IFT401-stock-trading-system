const crypto = require("crypto");
const { promisify } = require("util");
const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Session = require("../models/Session");
const { authenticate, requireAdmin } = require("../middleware/auth");
const Stock = require("../models/Stock");
const MarketSettings = require("../models/MarketSettings");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const adjustCashBalance = require("../services/adjustCashBalance");
const buyStock = require("../services/buyStock");
const sellStock = require("../services/sellStock");
const ensureDefaultStocks = require("../services/defaultStocks");
const {
    cancelLimitOrder,
    placeLimitOrder
} = require("../services/limitOrders");
const transactionCostBasis = require("../services/portfolioProfitLoss");
const {
    getMarketSettings,
    isMarketOpen,
    publicMarketSettings
} = require("../services/marketSchedule");

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = "stocktrade_session";
const SESSION_LENGTH = 7 * 24 * 60 * 60 * 1000;

function asyncRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicUser(user) {
    return {
        id: user._id,
        f_name: user.first_name,
        l_name: user.last_name,
        username: user.username,
        email: user.email,
        balance: user.balance,
        admin_acc: user.admin_acc
    };
}

function cookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure || req.get("x-forwarded-proto") === "https",
        path: "/",
        maxAge: SESSION_LENGTH
    };
}

function isValidCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

router.post("/auth/register", asyncRoute(async (req, res) => {
    const { f_name, l_name, username, email, password } = req.body || {};
    if (![f_name, l_name, username, email, password].every(
        (value) => typeof value === "string" && value.trim()
    )) {
        return res.status(400).json({ error: "Please fill out every field." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({
        $or: [
            { username: normalizedUsername },
            { email: normalizedEmail }
        ]
    }).collation({ locale: "en", strength: 2 });
    if (existing) {
        const field = existing.username.toLowerCase() === normalizedUsername ? "username" : "email";
        return res.status(409).json({
            error: field === "username"
                ? "That username is already taken."
                : "An account with that email already exists."
        });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await scrypt(password, salt, 64);
    const user = await User.create({
        first_name: f_name.trim(),
        last_name: l_name.trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        password_hash: `${salt}:${passwordHash.toString("hex")}`,
        balance: 100000
    });
    await ensureDefaultStocks(user._id);
    const token = crypto.randomBytes(32).toString("hex");
    await Session.create({
        token_hash: crypto.createHash("sha256").update(token).digest("hex"),
        user_id: user._id,
        expires_at: new Date(Date.now() + SESSION_LENGTH)
    });

    res.cookie(SESSION_COOKIE, token, cookieOptions(req));
    res.status(201).json({ user: publicUser(user) });
}));

router.post("/auth/login", asyncRoute(async (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
        return res.status(400).json({ error: "Enter your username and password." });
    }

    const user = await User.findOne({ username }).collation({ locale: "en", strength: 2 });
    if (!user || !user.password_hash.includes(":")) {
        return res.status(401).json({ error: "Username or password is incorrect." });
    }
    const [salt, storedHash] = user.password_hash.split(":");
    const passwordHash = await scrypt(password, salt, 64);
    const expectedHash = Buffer.from(storedHash, "hex");
    if (expectedHash.length !== passwordHash.length ||
        !crypto.timingSafeEqual(expectedHash, passwordHash)) {
        return res.status(401).json({ error: "Username or password is incorrect." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await Session.create({
        token_hash: crypto.createHash("sha256").update(token).digest("hex"),
        user_id: user._id,
        expires_at: new Date(Date.now() + SESSION_LENGTH)
    });
    res.cookie(SESSION_COOKIE, token, cookieOptions(req));
    res.json({ user: publicUser(user) });
}));

router.post("/auth/logout", authenticate, asyncRoute(async (req, res) => {
    await req.sessionRecord.deleteOne();
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
    res.status(204).end();
}));

router.get("/auth/session", authenticate, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

router.get("/market/stocks", authenticate, asyncRoute(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const stocks = await Stock.find().sort({ symbol: 1 }).lean();
    res.json(stocks.map((stock) => ({
        id: stock._id,
        symbol: stock.symbol,
        company_name: stock.company_name,
        market_price: stock.market_price,
        previous_close: stock.previous_close ?? stock.initial_price,
        day_open: stock.day_open ?? stock.market_price,
        day_high: stock.day_high ?? stock.market_price,
        day_low: stock.day_low ?? stock.market_price,
        price_history: stock.price_history || [],
        volume: stock.volume
    })));
}));

router.post("/market/stocks", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const { symbol, company_name, initial_price, volume } = req.body || {};
    const normalizedSymbol = typeof symbol === "string" ? symbol.trim().toUpperCase() : "";
    const companyName = typeof company_name === "string" ? company_name.trim() : "";
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(normalizedSymbol) ||
        !companyName ||
        companyName.length > 120 ||
        typeof initial_price !== "number" ||
        !Number.isFinite(initial_price) ||
        initial_price <= 0 ||
        !Number.isSafeInteger(volume) ||
        volume <= 0) {
        return res.status(400).json({
            error: "Enter a valid ticker, company name, positive initial price, and whole-share volume."
        });
    }

    try {
        const stock = await Stock.create({
            symbol: normalizedSymbol,
            company_name: companyName,
            initial_price,
            market_price: initial_price,
            volume,
            created_by: req.user._id
        });
        res.status(201).json({
            id: stock._id,
            symbol: stock.symbol,
            company_name: stock.company_name,
            market_price: stock.market_price,
            volume: stock.volume
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "That stock ticker already exists." });
        }
        throw error;
    }
}));

router.put("/market/stocks/:stockId", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const { market_price, volume } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.stockId)) {
        return res.status(400).json({ error: "Invalid stock ID." });
    }
    if (typeof market_price !== "number" ||
        !Number.isFinite(market_price) ||
        market_price <= 0 ||
        !Number.isSafeInteger(volume) ||
        volume < 0) {
        return res.status(400).json({
            error: "Enter a positive market price and a non-negative whole-share amount."
        });
    }

    const stock = await Stock.findById(req.params.stockId);
    if (!stock) return res.status(404).json({ error: "Stock not found." });

    const recordedAt = new Date();
    stock.market_price = market_price;
    stock.volume = volume;
    stock.day_open = market_price;
    stock.day_high = market_price;
    stock.day_low = market_price;
    stock.market_date = recordedAt.toISOString().slice(0, 10);
    stock.price_history.push({ price: market_price, recorded_at: recordedAt });
    if (stock.price_history.length > 60) {
        stock.price_history.splice(0, stock.price_history.length - 60);
    }
    await stock.save();

    res.json({
        id: stock._id,
        symbol: stock.symbol,
        company_name: stock.company_name,
        market_price: stock.market_price,
        volume: stock.volume
    });
}));

router.delete("/market/stocks/:stockId", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.stockId)) {
        return res.status(400).json({ error: "Invalid stock ID." });
    }

    const stockId = new mongoose.Types.ObjectId(req.params.stockId);
    const session = await mongoose.startSession();
    let deletedSymbol = null;
    try {
        await session.withTransaction(async () => {
            const stock = await Stock.findById(stockId).session(session);
            if (!stock) return;

            deletedSymbol = stock.symbol;
            await User.updateMany(
                { "portfolio.stock_id": stockId },
                { $pull: { portfolio: { stock_id: stockId } } },
                { session }
            );
            await Transaction.deleteMany({ stock_id: stockId }, { session });
            await Order.deleteMany({ stock_id: stockId }, { session });
            await Stock.deleteOne({ _id: stockId }, { session });
        });
    } finally {
        await session.endSession();
    }

    if (!deletedSymbol) return res.status(404).json({ error: "Stock not found." });
    res.json({ symbol: deletedSymbol });
}));

router.get("/market/schedule", authenticate, asyncRoute(async (req, res) => {
    const settings = await getMarketSettings();
    res.set("Cache-Control", "no-store");
    res.json(publicMarketSettings(settings));
}));

router.put("/market/schedule", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const { opens_at, closes_at, trading_days, holidays } = req.body || {};
    const validTime = (value) => typeof value === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(opens_at) ||
        !validTime(closes_at) ||
        opens_at >= closes_at ||
        !Array.isArray(trading_days) ||
        trading_days.some((day) => !Number.isInteger(day) || day < 1 || day > 5) ||
        new Set(trading_days).size !== trading_days.length ||
        !Array.isArray(holidays) ||
        holidays.length > 1000 ||
        holidays.some((holiday) => !isValidCalendarDate(holiday)) ||
        new Set(holidays).size !== holidays.length) {
        return res.status(400).json({
            error: "Enter valid market hours, weekdays, and unique holiday dates."
        });
    }

    const settings = await MarketSettings.findOneAndUpdate(
        { key: "default" },
        { $set: { opens_at, closes_at, trading_days, holidays } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(publicMarketSettings(settings));
}));

router.put("/market/clock", authenticate, requireAdmin, asyncRoute(async (req, res) => {
    const { current_datetime } = req.body || {};
    let clockOverride = null;
    if (current_datetime !== null) {
        const validDateTime = typeof current_datetime === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(current_datetime);
        const parsedDateTime = validDateTime ? new Date(current_datetime) : null;
        if (!parsedDateTime ||
            Number.isNaN(parsedDateTime.getTime()) ||
            parsedDateTime.toISOString() !== current_datetime) {
            return res.status(400).json({ error: "Enter a valid date and time." });
        }
        clockOverride = parsedDateTime;
    }

    const settings = await MarketSettings.findOneAndUpdate(
        { key: "default" },
        {
            $set: {
                clock_override: clockOverride,
                clock_override_started_at: clockOverride ? new Date() : null
            }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.set("Cache-Control", "no-store");
    res.json(publicMarketSettings(settings));
}));

router.get("/portfolio", authenticate, asyncRoute(async (req, res) => {
    const [user, transactions] = await Promise.all([
        User.findById(req.user._id).populate("portfolio.stock_id").lean(),
        Transaction.find({ user_id: req.user._id })
            .sort({ createdAt: 1, _id: 1 })
            .lean()
    ]);
    const transactionsByStock = new Map();
    transactions.forEach((transaction) => {
        const stockId = transaction.stock_id.toString();
        const stockTransactions = transactionsByStock.get(stockId) || [];
        stockTransactions.push(transaction);
        transactionsByStock.set(stockId, stockTransactions);
    });

    const holdings = user.portfolio
        .filter((holding) => holding.stock_id)
        .map((holding) => {
            const stock = holding.stock_id;
            const quantity = holding.quantity;
            const cost_basis = transactionCostBasis(
                transactionsByStock.get(stock._id.toString()) || [],
                quantity,
                stock.initial_price
            );
            const market_value = stock.market_price * quantity;
            const cost_value = cost_basis * quantity;
            const profit_loss = market_value - cost_value;

            return {
                stock: {
                    id: stock._id,
                    symbol: stock.symbol,
                    company_name: stock.company_name,
                    initial_price: stock.initial_price,
                    market_price: stock.market_price
                },
                quantity,
                cost_basis,
                market_value,
                profit_loss,
                profit_loss_percent: cost_value > 0 ? (profit_loss / cost_value) * 100 : 0
            };
        });
    const portfolio_value = holdings.reduce((total, holding) => total + holding.market_value, 0);
    const cost_value = holdings.reduce(
        (total, holding) => total + holding.cost_basis * holding.quantity,
        0
    );
    const profit_loss = portfolio_value - cost_value;

    res.json({
        cash_balance: user.balance,
        portfolio_value,
        profit_loss,
        profit_loss_percent: cost_value > 0 ? (profit_loss / cost_value) * 100 : 0,
        holdings
    });
}));

router.post("/account/cash", authenticate, asyncRoute(async (req, res) => {
    const { adjustment_type, amount } = req.body || {};
    if (!["deposit", "withdraw"].includes(adjustment_type) ||
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
        return res.status(400).json({
            error: "Choose deposit or withdraw and enter a positive amount with up to two decimal places."
        });
    }

    try {
        const result = await adjustCashBalance(req.user._id, adjustment_type, amount);
        res.json(result);
    } catch (error) {
        if (error.message === "User not found.") {
            return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("Withdrawal exceeds")) {
            return res.status(400).json({ error: error.message });
        }
        throw error;
    }
}));

router.get("/orders", authenticate, asyncRoute(async (req, res) => {
    const [recentOrders, pendingOrders] = await Promise.all([
        Order.find({ user_id: req.user._id })
            .populate("stock_id", "symbol company_name")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        Order.find({
            user_id: req.user._id,
            order_kind: "limit",
            order_status: "pending"
        })
            .populate("stock_id", "symbol company_name")
            .sort({ createdAt: -1 })
            .lean()
    ]);
    const orders = [...new Map(
        [...recentOrders, ...pendingOrders].map((order) => [order._id.toString(), order])
    ).values()].sort((left, right) => right.createdAt - left.createdAt);
    res.json(orders.map((order) => ({
        id: order._id,
        symbol: order.stock_id?.symbol || "—",
        company_name: order.stock_id?.company_name || "Unknown stock",
        order_type: order.order_type,
        order_kind: order.order_kind || "market",
        quantity: order.quantity,
        price: order.price,
        order_status: order.order_status,
        created_at: order.createdAt
    })));
}));

router.get("/transactions", authenticate, asyncRoute(async (req, res) => {
    const transactions = await Transaction.find({ user_id: req.user._id })
        .populate("stock_id", "symbol company_name")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    res.json(transactions.map((transaction) => ({
        id: transaction._id,
        symbol: transaction.stock_id?.symbol || "—",
        company_name: transaction.stock_id?.company_name || "Unknown stock",
        transaction_type: transaction.transaction_type,
        quantity: transaction.quantity,
        price: transaction.price,
        total_amount: transaction.total_amount,
        created_at: transaction.createdAt
    })));
}));

router.get("/history", authenticate, asyncRoute(async (req, res) => {
    const [transactions, pendingOrders, cancelledOrders] = await Promise.all([
        Transaction.find({ user_id: req.user._id })
            .populate("stock_id", "symbol company_name")
            .populate("order_id", "order_kind order_status")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean(),
        Order.find({
            user_id: req.user._id,
            order_kind: "limit",
            order_status: "pending"
        })
            .populate("stock_id", "symbol company_name")
            .sort({ createdAt: -1 })
            .lean(),
        Order.find({
            user_id: req.user._id,
            order_kind: "limit",
            order_status: "cancelled"
        })
            .populate("stock_id", "symbol company_name")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
    ]);

    const history = [
        ...transactions.map((transaction) => ({
            id: transaction._id,
            order_id: transaction.order_id?._id,
            symbol: transaction.stock_id?.symbol || "—",
            company_name: transaction.stock_id?.company_name || "Unknown stock",
            side: transaction.transaction_type,
            order_kind: transaction.order_id?.order_kind || "market",
            status: "completed",
            quantity: transaction.quantity,
            price: transaction.price,
            total_amount: transaction.total_amount,
            created_at: transaction.createdAt,
            entry_type: "trade"
        })),
        ...[...pendingOrders, ...cancelledOrders].map((order) => ({
            id: order._id,
            order_id: order._id,
            symbol: order.stock_id?.symbol || "—",
            company_name: order.stock_id?.company_name || "Unknown stock",
            side: order.order_type,
            order_kind: "limit",
            status: order.order_status,
            quantity: order.quantity,
            price: order.price,
            total_amount: null,
            created_at: order.createdAt,
            entry_type: "order"
        }))
    ].sort((left, right) => right.created_at - left.created_at);

    res.json(history);
}));

router.post("/trades", authenticate, asyncRoute(async (req, res) => {
    const {
        stock_id,
        side,
        quantity,
        order_kind = "market",
        limit_price
    } = req.body || {};
    if (typeof stock_id !== "string" || !["buy", "sell"].includes(side) ||
        !mongoose.isValidObjectId(stock_id) ||
        !Number.isInteger(quantity) || quantity <= 0 ||
        !["market", "limit"].includes(order_kind)) {
        return res.status(400).json({ error: "Choose a stock, order type, and positive whole-share quantity." });
    }
    if (order_kind === "limit" &&
        (typeof limit_price !== "number" || !Number.isFinite(limit_price) || limit_price <= 0)) {
        return res.status(400).json({ error: "Enter a limit price greater than zero." });
    }

    try {
        if (order_kind === "market" && !isMarketOpen(await getMarketSettings())) {
            return res.status(403).json({
                error: "The market is closed. Trades can only execute during market hours."
            });
        }
        const result = order_kind === "limit"
            ? await placeLimitOrder(req.user._id, stock_id, side, quantity, limit_price)
            : side === "buy"
                ? await buyStock(req.user._id, stock_id, quantity)
                : await sellStock(req.user._id, stock_id, quantity);
        const user = await User.findById(req.user._id);
        res.status(order_kind === "limit" ? 201 : 200).json({
            balance: user.balance,
            order_id: result.order._id,
            order_status: result.order.order_status
        });
    } catch (error) {
        if (["User not found.", "Stock not found."].includes(error.message) ||
            error.message.includes("balance") ||
            error.message.includes("stock volume") ||
            error.message.includes("own enough") ||
            error.message.includes("Quantity")) {
            return res.status(400).json({ error: error.message });
        }
        throw error;
    }
}));

router.post("/orders/:orderId/cancel", authenticate, asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ error: "Invalid order ID." });
    }
    try {
        const result = await cancelLimitOrder(req.user._id, req.params.orderId);
        res.json(result);
    } catch (error) {
        if (error.message.includes("no longer pending")) {
            return res.status(409).json({ error: error.message });
        }
        if (error.message === "User not found.") {
            return res.status(404).json({ error: error.message });
        }
        throw error;
    }
}));

router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("API request failed:", error);
    if (error.code === 11000) {
        return res.status(409).json({ error: "That username or email is already registered." });
    }
    res.status(500).json({ error: "The request could not be completed. Please try again." });
});

module.exports = router;
