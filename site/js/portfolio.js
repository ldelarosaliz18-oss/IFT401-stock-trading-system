function renderPortfolio(target, portfolio) {
  target.replaceChildren();
  const holdings = portfolio.holdings;
  document.getElementById("portfolio-value").textContent = money(portfolio.portfolio_value);
  const profitLoss = document.getElementById("portfolio-profit-loss");
  const sign = portfolio.profit_loss > 0 ? "+" : "";
  profitLoss.textContent =
    `${sign}${money(portfolio.profit_loss)} (${sign}${portfolio.profit_loss_percent.toFixed(2)}%)`;
  profitLoss.className = portfolio.profit_loss >= 0 ? "up" : "down";
  document.getElementById("portfolio-cash").textContent = money(portfolio.cash_balance);

  if (!holdings.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Your portfolio is empty. Place a buy order to get started.";
    target.append(empty);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table portfolio-table";
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  ["Stock Ticker", "Shares Owned", "Average Buy Price", "Current Price",
    "Total Market Value", "P/L", "Return"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    header.append(cell);
  });
  head.append(header);

  const body = document.createElement("tbody");
  holdings.forEach((holding) => {
    const row = document.createElement("tr");
    [
      holding.stock.symbol,
      holding.quantity.toLocaleString("en-US"),
      money(holding.cost_basis),
      money(holding.stock.market_price),
      money(holding.market_value),
      money(holding.profit_loss),
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 0) cell.classList.add("portfolio-emphasis");
      if (index === 5) cell.classList.add(holding.profit_loss >= 0 ? "up" : "down");
      row.append(cell);
    });
    const returnCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className =
      `return-badge ${holding.profit_loss_percent >= 0 ? "positive" : "negative"}`;
    const returnSign = holding.profit_loss_percent > 0 ? "+" : "";
    badge.textContent = `${returnSign}${holding.profit_loss_percent.toFixed(1)}%`;
    returnCell.append(badge);
    row.append(returnCell);
    body.append(row);
  });
  table.append(head, body);
  wrapper.append(table);
  target.append(wrapper);
}

document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("table-target");
  const dialog = document.getElementById("cash-dialog");
  const form = document.getElementById("cash-form");
  const amountInput = document.getElementById("cash-amount");
  const error = document.getElementById("cash-error");
  let adjustmentType = "deposit";

  const refresh = async () => {
    const portfolio = await apiRequest("/portfolio");
    renderPortfolio(target, portfolio);
    const currentUser = await getSession();
    if (currentUser) setSession({ ...currentUser, balance: portfolio.cash_balance });
    refreshHeader();
  };

  document.querySelectorAll("[data-cash-action]").forEach((button) => {
    button.addEventListener("click", () => {
      adjustmentType = button.dataset.cashAction;
      document.getElementById("cash-dialog-title").textContent =
        adjustmentType === "deposit" ? "Deposit simulated cash" : "Withdraw simulated cash";
      document.getElementById("cash-submit").textContent =
        adjustmentType === "deposit" ? "Deposit" : "Withdraw";
      amountInput.value = "";
      error.hidden = true;
      error.textContent = "";
      dialog.showModal();
      amountInput.focus();
    });
  });

  document.getElementById("cash-dialog-cancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.hidden = true;
    error.textContent = "";
    const amount = Number(amountInput.value);
    const cents = amount * 100;
    if (!Number.isFinite(amount) || amount <= 0 ||
        Math.abs(cents - Math.round(cents)) > 1e-8) {
      error.textContent = "Enter an amount greater than zero with up to two decimal places.";
      error.hidden = false;
      return;
    }

    const submit = document.getElementById("cash-submit");
    submit.disabled = true;
    try {
      const result = await apiRequest("/account/cash", {
        method: "POST",
        body: JSON.stringify({ adjustment_type: adjustmentType, amount }),
      });
      if (sessionUser) setSession({ ...sessionUser, balance: result.balance });
      dialog.close();
      await refresh();
    } catch (requestError) {
      error.textContent = requestError.message;
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  try {
    await refresh();
    window.setInterval(() => {
      refresh().catch((requestError) => {
        target.replaceChildren();
        const failure = document.createElement("p");
        failure.className = "empty";
        failure.textContent = requestError.message;
        target.append(failure);
      });
    }, 5000);
  } catch (requestError) {
    const failure = document.createElement("p");
    failure.className = "empty";
    failure.textContent = requestError.message;
    target.append(failure);
  }
});
