require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Stock = require("./models/Stock");
const Transaction = require("./models/Transaction");

const createTestTransaction = async () => {
    try {
        await connectDB();

        const user = await User.findOne({
            username: "testuser1"
        });

        if (!user) {
            console.log("Test user not found.");
            await mongoose.connection.close();
            return;
        }

        const stock = await Stock.findOne({
            symbol: "AAPL"
        });

        if (!stock) {
            console.log("Test stock not found.");
            await mongoose.connection.close();
            return;
        }

        const quantity = 10;
        const price = stock.market_price;

        const transaction = await Transaction.create({
            user_id: user._id,
            stock_id: stock._id,
            transaction_type: "buy",
            quantity: quantity,
            price: price,
            total_amount: quantity * price
        });

        console.log("Transaction created successfully:");
        console.log(transaction);

        await mongoose.connection.close();

    } catch (error) {
        console.error("Error creating transaction:", error.message);
        await mongoose.connection.close();
    }
};

createTestTransaction();