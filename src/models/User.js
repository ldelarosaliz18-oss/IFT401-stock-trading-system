const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        first_name: {
            type: String,
            required: true
        },

        last_name: {
            type: String,
            required: true
        },

        username: {
            type: String,
            required: true,
            unique: true
        },

        email: {
            type: String,
            required: true,
            unique: true
        },

        password_hash: {
            type: String,
            required: true
        },

        balance: {
            type: Number,
            default: 0,
            min: 0
        },

        admin_acc: {
            type: Boolean,
            default: false
        },

        portfolio: [
            {
                stock_id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Stock"
                },

                quantity: {
                    type: Number,
                    default: 0,
                    min: 0
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);