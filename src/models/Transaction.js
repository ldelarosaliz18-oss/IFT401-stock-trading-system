const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        stock_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Stock",
            required: true
        },

        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: false
        },

        transaction_type: {
            type: String,
            required: true,
            enum: ["buy", "sell"]
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        total_amount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Transaction", transactionSchema);