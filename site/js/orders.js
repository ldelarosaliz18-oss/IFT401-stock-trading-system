function setOrderReview(stocks, side) {
  const select = document.getElementById("stock-symbol");
  const stock = stocks.find((item) => item.id === select.value) || stocks[0];
  const quantityInput = document.getElementById("qty");
  const quantity = Number(quantityInput.value);
  const isLimit = document.getElementById("order-kind").value === "limit";
  const marketPrice = stock ? Number(stock.market_price) : 0;
  const limitPrice = Number(document.getElementById("limit-price").value);
  const price = isLimit && Number.isFinite(limitPrice) && limitPrice > 0
    ? limitPrice
    : marketPrice;
  document.getElementById("limit-wrap").hidden = !isLimit;
  document.getElementById("review-action").textContent = side.toUpperCase();
  document.getElementById("review-security").textContent = stock
    ? `${stock.company_name} (${stock.symbol})`
    : "No stock selected";
  document.getElementById("review-qty").textContent =
    `${Number.isFinite(quantity) ? quantity : 0} Shares`;
  document.getElementById("market-price").value = money(marketPrice);
  document.getElementById("review-price-label").textContent =
    isLimit ? "Limit Price" : "Execution Price";
  document.getElementById("review-limit").textContent = money(price);
  document.getElementById("review-cost").textContent = money(price * quantity);
  document.getElementById("review-cost-label").textContent =
    side === "buy" ? "Estimated Cost" : "Estimated Proceeds";
  document.getElementById("complete-order").textContent =
    isLimit ? "Place Limit Order" : "Complete Order";
  return stock;
}

function tableForOrders(orders, onCancel) {
  const section = document.getElementById("open-orders");
  section.hidden = false;
  section.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "Recent Orders";
  section.append(heading);
  if (!orders.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "You have not placed any orders yet.";
    section.append(empty);
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  ["Date", "Stock Ticker", "Action", "Type", "Shares", "Order Price", "Status", "Action"]
    .forEach((label) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      header.append(cell);
    });
  head.append(header);
  const body = document.createElement("tbody");
  orders.forEach((order) => {
    const row = document.createElement("tr");
    [
      new Date(order.created_at).toLocaleString(),
      order.symbol,
      order.order_type,
      order.order_kind === "limit" ? "Limit" : "Market",
      order.quantity,
      money(order.price),
      order.order_status,
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    });
    const action = document.createElement("td");
    if (order.order_kind === "limit" && order.order_status === "pending") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-cancel";
      button.textContent = "Cancel";
      button.addEventListener("click", () => onCancel(order));
      action.append(button);
    } else {
      action.textContent = "—";
    }
    row.append(action);
    body.append(row);
  });
  table.append(head, body);
  wrapper.append(table);
  section.append(wrapper);
}

document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("order-message");
  let side = "buy";
  try {
    let [stocks, orders] = await Promise.all([
      loadMarketStocks(),
      apiRequest("/orders"),
    ]);
    const select = document.getElementById("stock-symbol");
    const orderKind = document.getElementById("order-kind");
    const limitPriceInput = document.getElementById("limit-price");
    const quantityInput = document.getElementById("qty");
    if (stocks.length && !limitPriceInput.value) {
      limitPriceInput.value = Number(stocks[0].market_price).toFixed(2);
    }
    const populateStocks = (selectedId) => {
      select.replaceChildren();
      stocks.forEach((stock) => {
        const option = document.createElement("option");
        option.value = stock.id;
        option.textContent = `${stock.company_name} (${stock.symbol})`;
        select.append(option);
      });
      if (stocks.some((stock) => stock.id === selectedId)) {
        select.value = selectedId;
      }
      document.getElementById("complete-order").disabled = !stocks.length;
      setOrderReview(stocks, side);
    };
    populateStocks(stocks[0]?.id);
    document.querySelectorAll(".side-btn").forEach((button) => {
      button.addEventListener("click", () => {
        side = button.dataset.side;
        document.querySelectorAll(".side-btn").forEach((item) =>
          item.classList.toggle("active", item === button)
        );
        setOrderReview(stocks, side);
      });
    });
    select.addEventListener("change", () => setOrderReview(stocks, side));
    orderKind.addEventListener("change", () => {
      if (orderKind.value === "limit") {
        const selectedStock = stocks.find((stock) => stock.id === select.value);
        if (selectedStock) {
          limitPriceInput.value = Number(selectedStock.market_price).toFixed(2);
        }
      }
      setOrderReview(stocks, side);
    });
    limitPriceInput.addEventListener("input", () => setOrderReview(stocks, side));
    quantityInput.addEventListener("input", () => setOrderReview(stocks, side));
    wireQuantityShortcuts(
      "order-quantity-shortcuts",
      quantityInput,
      async () => {
        const [account, portfolio, latestStocks] = await Promise.all([
          apiRequest("/auth/session"),
          apiRequest("/portfolio"),
          refreshMarketStocks(),
        ]);
        stocks = latestStocks;
        const selectedStock = stocks.find((stock) => stock.id === select.value);
        if (!selectedStock) throw new Error("Select a stock before choosing a quantity.");
        if (side === "sell") {
          return portfolio.holdings.find(
            (holding) => holding.stock.id === selectedStock.id
          )?.quantity || 0;
        }
        const price = orderKind.value === "limit"
          ? Number(limitPriceInput.value)
          : selectedStock.market_price;
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error("Enter a valid order price before choosing a maximum buy quantity.");
        }
        return Math.floor(account.user.balance / price);
      },
      (error) => setTradeMessage(message, error.message, false)
    );
    document.getElementById("complete-order").addEventListener("click", async () => {
      const stock = setOrderReview(stocks, side);
      const quantity = Number(quantityInput.value);
      const kind = orderKind.value;
      const limitPrice = Number(limitPriceInput.value);
      if (!stock || !Number.isInteger(quantity) || quantity < 1) {
        setTradeMessage(message, "Select a stock and enter a positive whole-share quantity.", false);
        return;
      }
      if (kind === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0)) {
        setTradeMessage(message, "Enter a limit price greater than zero.", false);
        return;
      }
      try {
        const result = await executeTrade(stock.id, side, quantity, kind, limitPrice);
        setTradeMessage(
          message,
          kind === "limit"
            ? `Limit order placed and pending.`
            : "Order completed successfully.",
          true
        );
        if (kind === "limit" && result.balance !== undefined) {
          setSession({ ...sessionUser, balance: result.balance });
          refreshHeader();
        }
        try {
          stocks = await refreshMarketStocks();
          populateStocks(stock.id);
          tableForOrders(await apiRequest("/orders"), cancelOrder);
        } catch (error) {
          setTradeMessage(message, `Order completed, but the page could not refresh: ${error.message}`, false);
        }
      } catch (error) {
        setTradeMessage(message, error.message, false);
      }
    });
    tableForOrders(orders, cancelOrder);
    window.setInterval(async () => {
      try {
        const selectedId = select.value;
        stocks = await refreshMarketStocks();
        populateStocks(selectedId);
        tableForOrders(await apiRequest("/orders"), cancelOrder);
      } catch (error) {
        setTradeMessage(message, error.message, false);
      }
    }, 5000);

    async function cancelOrder(order) {
      try {
        const result = await apiRequest(`/orders/${order.id}/cancel`, { method: "POST" });
        setSession({ ...sessionUser, balance: result.balance });
        refreshHeader();
        setTradeMessage(message, "Pending limit order was successfully cancelled.", true);
        tableForOrders(await apiRequest("/orders"), cancelOrder);
      } catch (error) {
        setTradeMessage(message, error.message, false);
      }
    }
  } catch (error) {
    setTradeMessage(message, error.message, false);
  }
});
