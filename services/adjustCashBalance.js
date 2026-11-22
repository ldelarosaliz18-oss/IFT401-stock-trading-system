const mongoose = require("mongoose");

const User = require("../models/User");
const CashAdjustment = require("../models/CashAdjustment");

async function adjustCashBalance(userId, adjustmentType, amount) {
    const session = await mongoose.startSession();
    let balance;

    try {
        await session.withTransaction(async () => {
            const filter = { _id: userId };
            const adjustment = adjustmentType === "deposit" ? amount : -amount;
            if (adjustmentType === "withdraw") filter.balance = { $gte: amount };

            const user = await User.findOneAndUpdate(
                filter,
                { $inc: { balance: adjustment } },
                { new: true, runValidators: true, session }
            );
            if (!user) {
                const exists = await User.exists({ _id: userId }).session(session);
                if (!exists) throw new Error("User not found.");
                throw new Error("Withdrawal exceeds your available cash balance.");
            }

            balance = user.balance;
            await CashAdjustment.create(
                [{
                    user_id: user._id,
                    adjustment_type: adjustmentType,
                    amount,
                    balance_after: balance
                }],
                { session }
            );
        });
        return { balance };
    } finally {
        await session.endSession();
    }
}

module.exports = adjustCashBalance;
