const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
    {
        token_hash: {
            type: String,
            required: true,
            unique: true
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        expires_at: {
            type: Date,
            required: true,
            expires: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
