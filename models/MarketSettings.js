const mongoose = require("mongoose");

const marketSettingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: "default"
        },
        opens_at: {
            type: String,
            required: true,
            default: "09:30"
        },
        closes_at: {
            type: String,
            required: true,
            default: "16:00"
        },
        trading_days: {
            type: [Number],
            required: true,
            default: [1, 2, 3, 4, 5]
        },
        holidays: {
            type: [String],
            default: []
        },
        clock_override: {
            type: Date,
            default: null
        },
        clock_override_started_at: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("MarketSettings", marketSettingsSchema);
