const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
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

        order_type: {
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

        order_status: {
            type: String,
            required: true,
            enum: ["pending", "completed", "cancelled"],
            default: "pending"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Order", orderSchema);