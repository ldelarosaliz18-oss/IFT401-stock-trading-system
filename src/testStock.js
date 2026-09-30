require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Stock = require("./models/Stock");

const createTestStock = async () => {
    try {
        await connectDB();

        const adminUser = await User.findOne({
            username: "testuser1"
        });

        if (!adminUser) {
            console.log("Test user not found.");
            await mongoose.connection.close();
            return;
        }

        const stock = await Stock.create({
            symbol: "AAPL",
            company_name: "Apple Inc.",
            initial_price: 150.00,
            market_price: 150.00,
            volume: 10000,
            created_by: adminUser._id
        });

        console.log("Stock created:");
        console.log(stock);

        await mongoose.connection.close();

    } catch (error) {
        console.error("Error creating stock:", error.message);
        await mongoose.connection.close();
    }
};

createTestStock();