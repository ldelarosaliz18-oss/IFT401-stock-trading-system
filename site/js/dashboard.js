let dashboardStocks = [];
let selectedStockId = null;

function stockChange(stock) {
  const previousClose = Number(stock.previous_close) || Number(stock.market_price);
  const change = Number(stock.market_price) - previousClose;
  const percentage = previousClose ? (change / previousClose) * 100 : 0;
  return { change, percentage };
}

function displayChange(stock) {
  const { change, percentage } = stockChange(stock);
  const sign = change > 0 ? "+" : "";
  return `${sign}${money(change)} (${sign}${percentage.toFixed(2)}%)`;
}

function showQuote(stock) {
  if (!stock) return;
  selectedStockId = stock.id;
  document.getElementById("buy-order").disabled = false;
  document.getElementById("sell-order").disabled = false;
  const { change, percentage } = stockChange(stock);
  const changeElement = document.getElementById("quote-change");
  document.getElementById("quote-name").textContent =
    `${stock.company_name} (${stock.symbol})`;
  document.getElementById("quote-price").textContent = money(stock.market_price);
  changeElement.textContent = displayChange(stock);
  changeElement.className = change >= 0 ? "up" : "down";
  document.getElementById("stat-prev").textContent =
    money(stock.previous_close ?? stock.market_price);
  document.getElementById("stat-open").textContent =
    money(stock.day_open ?? stock.market_price);
  document.getElementById("stat-low").textContent =
    money(stock.day_low ?? stock.market_price);
  document.getElementById("stat-high").textContent =
    money(stock.day_high ?? stock.market_price);
  document.getElementById("stat-volume").textContent =
    Number(stock.volume).toLocaleString("en-US");
  document.getElementById("stat-market-cap").textContent =
    money(Number(stock.volume) * Number(stock.market_price));
  const dailyChange = document.getElementById("stat-cap");
  dailyChange.textContent = displayChange(stock);
  dailyChange.className = change >= 0 ? "up" : "down";
  document.getElementById("share-qty").dataset.stockId = stock.id;
  renderWatchlist(dashboardStocks);
}

function clearDashboardQuote() {
  selectedStockId = null;
  document.getElementById("quote-name").textContent = "No stocks available";
  document.getElementById("quote-price").textContent = "—";
  const quoteChange = document.getElementById("quote-change");
  quoteChange.textContent = "";
  quoteChange.className = "";
  document.getElementById("stat-prev").textContent = "—";
  document.getElementById("stat-open").textContent = "—";
  document.getElementById("stat-low").textContent = "—";
  document.getElementById("stat-high").textContent = "—";
  document.getElementById("stat-volume").textContent = "—";
  document.getElementById("stat-market-cap").textContent = "—";
  const dailyChange = document.getElementById("stat-cap");
  dailyChange.textContent = "—";
  dailyChange.className = "";
  document.getElementById("share-qty").dataset.stockId = "";
  document.getElementById("buy-order").disabled = true;
  document.getElementById("sell-order").disabled = true;
}

function renderWatchlist(stocks) {
  const list = document.getElementById("watchlist");
  list.replaceChildren();
  if (!stocks.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No stocks are available yet.";
    list.append(empty);
    return;
  }

  stocks.forEach((stock) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `watch-row${stock.id === selectedStockId ? " selected" : ""}`;
    row.addEventListener("click", () => showQuote(stock));
    const identity = document.createElement("span");
    const symbol = document.createElement("span");
    symbol.className = "watch-symbol";
    symbol.textContent = stock.symbol;
    const company = document.createElement("span");
    company.className = "watch-name";
    company.textContent = stock.company_name;
    identity.append(symbol, company);
    const quote = document.createElement("span");
    quote.className = "watch-quote";
    const price = document.createElement("span");
    price.className = "watch-price";
    price.textContent = money(stock.market_price);
    const change = document.createElement("span");
    const delta = stockChange(stock);
    change.className = delta.change >= 0 ? "up" : "down";
    change.textContent = displayChange(stock);
    quote.append(price, change);
    row.append(identity, quote);
    list.append(row);
  });
}

async function refreshDashboard() {
  dashboardStocks = await refreshMarketStocks();
  renderWatchlist(dashboardStocks);
  const selected = dashboardStocks.find((stock) => stock.id === selectedStockId);
  if (selected) {
    showQuote(selected);
  } else if (dashboardStocks.length) {
    showQuote(dashboardStocks[0]);
  } else {
    clearDashboardQuote();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("trade-message");
  try {
    dashboardStocks = await loadMarketStocks();
    if (dashboardStocks.length) showQuote(dashboardStocks[0]);
    else {
      renderWatchlist(dashboardStocks);
      clearDashboardQuote();
    }
    wireQuantityShortcuts(
      "dashboard-quantity-shortcuts",
      document.getElementById("share-qty"),
      async (side) => {
        const [account, portfolio, stocks] = await Promise.all([
          apiRequest("/auth/session"),
          apiRequest("/portfolio"),
          refreshMarketStocks(),
        ]);
        dashboardStocks = stocks;
        const stock = stocks.find((item) => item.id === selectedStockId);
        if (!stock) throw new Error("Select a stock before choosing a quantity.");
        if (side === "sell") {
          return portfolio.holdings.find(
            (holding) => holding.stock.id === stock.id
          )?.quantity || 0;
        }
        const affordable = Math.floor(account.user.balance / stock.market_price);
        return Math.min(affordable, stock.volume);
      },
      (error) => setTradeMessage(message, error.message, false)
    );

    for (const side of ["buy", "sell"]) {
      document.getElementById(`${side}-order`).addEventListener("click", async () => {
        const quantity = Number(document.getElementById("share-qty").value);
        const stockId = document.getElementById("share-qty").dataset.stockId;
        if (!stockId || !Number.isInteger(quantity) || quantity < 1) {
          setTradeMessage(message, "Select a stock and enter a positive share quantity.", false);
          return;
        }
        try {
          await executeTrade(stockId, side, quantity);
          setTradeMessage(message, `${side === "buy" ? "Bought" : "Sold"} ${quantity} shares.`, true);
          try {
            await refreshDashboard();
          } catch (error) {
            setTradeMessage(message, `Trade completed, but the dashboard could not refresh: ${error.message}`, false);
          }
        } catch (error) {
          setTradeMessage(message, error.message, false);
        }
      });
    }

    window.setInterval(() => {
      refreshDashboard().catch((error) => {
        setTradeMessage(message, error.message, false);
      });
    }, 5000);
  } catch (error) {
    setTradeMessage(message, error.message, false);
  }
});
