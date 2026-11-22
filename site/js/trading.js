async function executeTrade(stockId, side, quantity, orderKind = "market", limitPrice) {
  const result = await apiRequest("/trades", {
    method: "POST",
    body: JSON.stringify({
      stock_id: stockId,
      side,
      quantity,
      order_kind: orderKind,
      ...(orderKind === "limit" ? { limit_price: limitPrice } : {}),
    }),
  });
  setSession({ ...sessionUser, balance: result.balance });
  refreshHeader();
  return result;
}

function setTradeMessage(element, message, success) {
  if (!element) return;
  element.hidden = !message;
  element.textContent = message || "";
  element.classList.toggle("ok", Boolean(message && success));
  element.classList.toggle("bad", Boolean(message && !success));
}
