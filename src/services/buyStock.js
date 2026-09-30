const mongoose = require("mongoose");

const User = require("../models/User");
const Stock = require("../models/Stock");
const Order = require("../models/Order");
const Transaction = require("../models/Transaction");

const buyStock = async (userId, stockId, quantity) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const user = await User.findById(userId).session(session);

        if (!user) {
            throw new Error("User not found.");
        }

        const stock = await Stock.findById(stockId).session(session);

        if (!stock) {
            throw new Error("Stock not found.");
        }

        if (quantity <= 0) {
            throw new Error("Quantity must be greater than zero.");
        }

        if (stock.volume < quantity) {
            throw new Error("Not enough stock volume available.");
        }

        const price = stock.market_price;
        const totalAmount = price * quantity;

        if (user.balance < totalAmount) {
            throw new Error("Insufficient balance.");
        }

        const orders = await Order.create(
            [
                {
                    user_id: user._id,
                    stock_id: stock._id,
                    order_type: "buy",
                    quantity: quantity,
                    price: price,
                    order_status: "pending"
                }
            ],
            { session }
        );

        const order = orders[0];

        user.balance -= totalAmount;


        const holding = user.portfolio.find(
            item => item.stock_id.toString() === stock._id.toString()
        );

        if (holding) {
            holding.quantity += quantity;
        } else {
            user.portfolio.push({
                stock_id: stock._id,
                quantity: quantity
            });
        }

        await user.save({ session });

        stock.volume -= quantity;

        await stock.save({ session });

        const transactions = await Transaction.create(
            [
                {
                    user_id: user._id,
                    stock_id: stock._id,
                    order_id: order._id,
                    transaction_type: "buy",
                    quantity: quantity,
                    price: price,
                    total_amount: totalAmount
                }
            ],
            { session }
        );

        const transaction = transactions[0];

        order.order_status = "completed";

        await order.save({ session });

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

module.exports = buyStock;