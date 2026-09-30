require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");

const createTestUser = async () => {
    try {
        await connectDB();

        const user = await User.create({
            first_name: "Test",
            last_name: "User",
            username: "testuser1",
            email: "testuser1@example.com",
            password_hash: "temporary-test-value",
            balance: 10000
        });

        console.log("User created:");
        console.log(user);

        await mongoose.connection.close();
    } catch (error) {
        console.error(error);
        await mongoose.connection.close();
    }
};

createTestUser();