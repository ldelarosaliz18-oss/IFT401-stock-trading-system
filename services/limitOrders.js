const mongoose = require("mongoose");

const User = require("../models/User");
const Stock = require("../models/Stock");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");
const { getMarketSettings, isMarketOpen } = require("./marketSchedule");

function addHolding(user, stockId, quantity) {
    const holding = user.portfolio.find(
        (item) => item.stock_id.toString() === stockId.toString()
    );
    if (holding) {
        holding.quantity += quantity;
    } else {
        user.portfolio.push({ stock_id: stockId, quantity });
    }
}

function removeHolding(user, holding, quantity) {
    holding.quantity -= quantity;
    if (holding.quantity === 0) user.portfolio.pull(holding._id);
}

function limitOrderIsMarketable(order, marketPrice) {
    return order.order_type === "buy"
        ? marketPrice <= order.price
        : marketPrice >= order.price;
}

async function placeLimitOrder(userId, stockId, side, quantity, limitPrice) {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            const user = await User.findById(userId).session(session);
            if (!user) throw new Error("User not found.");
            const stock = await Stock.findById(stockId).session(session);
            if (!stock) throw new Error("Stock not found.");

            if (side === "buy") {
                const reservedCash = limitPrice * quantity;
                if (user.balance < reservedCash) throw new Error("Insufficient balance.");
                user.balance -= reservedCash;
            } else {
                const holding = user.portfolio.find(
                    (item) => item.stock_id.toString() === stock._id.toString()
                );
                if (!holding || holding.quantity < quantity) {
                    throw new Error("You do not own enough shares to place this sell order.");
                }
                removeHolding(user, holding, quantity);
            }

            const [order] = await Order.create(
                [{
                    user_id: user._id,
                    stock_id: stock._id,
                    order_type: side,
                    order_kind: "limit",
                    quantity,
                    price: limitPrice,
                    order_status: "pending"
                }],
                { session }
            );
            await user.save({ session });
            result = { order, balance: user.balance };
        });
        return result;
    } finally {
        await session.endSession();
    }
}

async function cancelLimitOrder(userId, orderId) {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            const order = await Order.findOne({
                _id: orderId,
                user_id: userId,
                order_kind: "limit",
                order_status: "pending"
            }).session(session);
            if (!order) throw new Error("This limit order is no longer pending or does not exist.");

            const user = await User.findById(userId).session(session);
            if (!user) throw new Error("User not found.");

            if (order.order_type === "buy") {
                user.balance += order.price * order.quantity;
            } else {
                addHolding(user, order.stock_id, order.quantity);
            }
            order.order_status = "cancelled";
            await user.save({ session });
            await order.save({ session });
            result = { balance: user.balance };
        });
        return result;
    } finally {
        await session.endSession();
    }
}

async function fillLimitOrder(orderId) {
    if (!isMarketOpen(await getMarketSettings())) return false;

    const session = await mongoose.startSession();
    let filled = false;

    try {
        await session.withTransaction(async () => {
            const order = await Order.findOne({
                _id: orderId,
                order_kind: "limit",
                order_status: "pending"
            }).session(session);
            if (!order) return;

            const marketPriceCondition = order.order_type === "buy"
                ? { $lte: order.price }
                : { $gte: order.price };
            const stock = await Stock.findOne({
                _id: order.stock_id,
                market_price: marketPriceCondition
            }).session(session);
            if (!stock || !limitOrderIsMarketable(order, stock.market_price)) return;
            if (order.order_type === "buy" && stock.volume < order.quantity) return;

            const user = await User.findById(order.user_id).session(session);
            if (!user) throw new Error(`Pending limit order ${order._id} has no user.`);
            const fillPrice = stock.market_price;
            const totalAmount = fillPrice * order.quantity;

            if (order.order_type === "buy") {
                user.balance += order.price * order.quantity - totalAmount;
                addHolding(user, stock._id, order.quantity);
                stock.volume -= order.quantity;
            } else {
                user.balance += totalAmount;
                stock.volume += order.quantity;
            }

            order.order_status = "completed";
            await user.save({ session });
            await stock.save({ session });
            await order.save({ session });
            await Transaction.create(
                [{
                    user_id: user._id,
                    stock_id: stock._id,
                    order_id: order._id,
                    transaction_type: order.order_type,
                    quantity: order.quantity,
                    price: fillPrice,
                    total_amount: totalAmount
                }],
                { session }
            );
            filled = true;
        });
        return filled;
    } finally {
        await session.endSession();
    }
}

async function processPendingLimitOrders() {
    if (!isMarketOpen(await getMarketSettings())) return;

    const pendingOrders = await Order.find({
        order_kind: "limit",
        order_status: "pending"
    }).select("_id").lean();

    for (const order of pendingOrders) {
        try {
            await fillLimitOrder(order._id);
        } catch (error) {
            console.error(`Could not process limit order ${order._id}:`, error);
        }
    }
}

module.exports = {
    cancelLimitOrder,
    limitOrderIsMarketable,
    placeLimitOrder,
    processPendingLimitOrders
};
