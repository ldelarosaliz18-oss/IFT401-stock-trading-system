require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Stock = require("./models/Stock");

const addTestPortfolioHolding = async () => {
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

        user.portfolio.push({
            stock_id: stock._id,
            quantity: 10
        });

        await user.save();

        console.log("Portfolio updated successfully:");
        console.log(user.portfolio);

        await mongoose.connection.close();

    } catch (error) {
        console.error("Error updating portfolio:", error.message);
        await mongoose.connection.close();
    }
};

addTestPortfolioHolding();