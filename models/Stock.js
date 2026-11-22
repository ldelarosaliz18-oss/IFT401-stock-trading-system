const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
    {
        symbol: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },

        company_name: {
            type: String,
            required: true,
            trim: true
        },

        initial_price: {
            type: Number,
            required: true,
            min: 0
        },

        market_price: {
            type: Number,
            required: true,
            min: 0
        },

        previous_close: {
            type: Number,
            min: 0
        },

        day_open: {
            type: Number,
            min: 0
        },

        day_high: {
            type: Number,
            min: 0
        },

        day_low: {
            type: Number,
            min: 0
        },

        market_date: {
            type: String
        },

        price_history: {
            type: [{
                price: { type: Number, required: true, min: 0 },
                recorded_at: { type: Date, required: true }
            }],
            default: []
        },

        volume: {
            type: Number,
            required: true,
            min: 0
        },

        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Stock", stockSchema);