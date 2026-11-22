const mongoose = require("mongoose");

const User = require("../models/User");
const Stock = require("../models/Stock");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");

const sellStock = async (userId, stockId, quantity) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);
        if (!user) throw new Error("User not found.");

        const stock = await Stock.findById(stockId).session(session);
        if (!stock) throw new Error("Stock not found.");
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error("Quantity must be a positive whole number.");
        }

        const holding = user.portfolio.find(
            (item) => item.stock_id.toString() === stock._id.toString()
        );
        if (!holding || holding.quantity < quantity) {
            throw new Error("You do not own enough shares to complete this sale.");
        }

        const price = stock.market_price;
        const totalAmount = price * quantity;
        const [order] = await Order.create(
            [{
                user_id: user._id,
                stock_id: stock._id,
                order_type: "sell",
                quantity,
                price,
                order_status: "completed"
            }],
            { session }
        );

        holding.quantity -= quantity;
        if (holding.quantity === 0) user.portfolio.pull(holding._id);
        user.balance += totalAmount;
        stock.volume += quantity;

        await user.save({ session });
        await stock.save({ session });
        const [transaction] = await Transaction.create(
            [{
                user_id: user._id,
                stock_id: stock._id,
                order_id: order._id,
                transaction_type: "sell",
                quantity,
                price,
                total_amount: totalAmount
            }],
            { session }
        );

        await session.commitTransaction();
        return {
            order,
            transaction,
            new_balance: user.balance,
            portfolio: user.portfolio
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

module.exports = sellStock;
