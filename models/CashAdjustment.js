const mongoose = require("mongoose");

const cashAdjustmentSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        adjustment_type: {
            type: String,
            required: true,
            enum: ["deposit", "withdraw"]
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },
        balance_after: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CashAdjustment", cashAdjustmentSchema);
