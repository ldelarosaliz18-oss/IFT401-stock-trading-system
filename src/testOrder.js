require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Stock = require("./models/Stock");
const Order = require("./models/Order");

const createTestOrder = async () => {
    try {
        await connectDB();

        const user = await User.findOne({
            username: "testuser1"
        });

        const stock = await Stock.findOne({
            symbol: "AAPL"
        });

        if (!user || !stock) {
            console.log("Test user or stock not found.");
            await mongoose.connection.close();
            return;
        }

        const order = await Order.create({
            user_id: user._id,
            stock_id: stock._id,
            order_type: "buy",
            quantity: 5,
            price: stock.market_price
        });

        console.log("Order created successfully:");
        console.log(order);

        await mongoose.connection.close();

    } catch (error) {
        console.error("Error creating order:", error.message);
        await mongoose.connection.close();
    }
};

createTestOrder();