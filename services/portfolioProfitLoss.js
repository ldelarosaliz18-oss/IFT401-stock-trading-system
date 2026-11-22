function transactionCostBasis(transactions, quantity, fallbackPrice) {
    let positionQuantity = 0;
    let positionCost = 0;

    transactions.forEach((transaction) => {
        if (transaction.transaction_type === "buy") {
            positionQuantity += transaction.quantity;
            positionCost += transaction.total_amount;
        } else if (transaction.transaction_type === "sell" && positionQuantity > 0) {
            const averageCost = positionCost / positionQuantity;
            const soldQuantity = Math.min(transaction.quantity, positionQuantity);
            positionQuantity -= soldQuantity;
            positionCost -= averageCost * soldQuantity;
        }
    });

    if (positionQuantity < quantity) {
        positionCost += (quantity - positionQuantity) * fallbackPrice;
    } else if (positionQuantity > quantity) {
        positionCost *= quantity / positionQuantity;
    }

    return quantity > 0 ? positionCost / quantity : fallbackPrice;
}

module.exports = transactionCostBasis;
