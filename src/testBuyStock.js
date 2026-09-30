require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");

const User = require("./models/User");
const Stock = require("./models/Stock");

const buyStock = require("./services/buyStock");

const testBuy = async () => {
    try {
        await connectDB();

        const user = await User.findOne({
            username: "testuser1"
        });

        const stock = await Stock.findOne({
            symbol: "AAPL"
        });

        if (!user || !stock) {
            console.log("User or stock not found.");
            await mongoose.connection.close();
            return;
        }

        const result = await buyStock(
            user._id,
            stock._id,
            2
        );

        console.log("Purchase completed successfully.");
        console.log("New balance:", result.new_balance);
        console.log("Portfolio:", result.portfolio);
        console.log("Order:", result.order);
        console.log("Transaction:", result.transaction);

    } catch (error) {
        console.error("Purchase failed:", error.message);

    } finally {
        await mongoose.connection.close();
    }
};

testBuy();