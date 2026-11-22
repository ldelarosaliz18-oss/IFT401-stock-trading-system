function renderHistory(target, entries, onCancel) {
  target.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No orders or completed trades to show yet.";
    target.append(empty);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  ["Date", "Stock Ticker", "Action", "Type", "Shares", "Price", "Total", "Status", "Action"]
    .forEach((label) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      header.append(cell);
    });
  head.append(header);

  const body = document.createElement("tbody");
  entries.forEach((entry) => {
    const row = document.createElement("tr");
    [
      new Date(entry.created_at).toLocaleString(),
      entry.symbol,
      entry.side,
      entry.order_kind,
      entry.quantity,
      money(entry.price),
      entry.total_amount === null ? "-" : money(entry.total_amount),
      entry.status,
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    });

    const action = document.createElement("td");
    if (entry.entry_type === "order" && entry.status === "pending") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "link-cancel";
      button.textContent = "Cancel";
      button.addEventListener("click", () => onCancel(entry));
      action.append(button);
    } else {
      action.textContent = "-";
    }
    row.append(action);
    body.append(row);
  });

  table.append(head, body);
  wrapper.append(table);
  target.append(wrapper);
}

document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("table-target");

  async function refreshHistory() {
    const entries = await apiRequest("/history");
    renderHistory(target, entries, cancelOrder);
  }

  async function cancelOrder(entry) {
    try {
      const result = await apiRequest(`/orders/${entry.order_id}/cancel`, {
        method: "POST",
      });
      setSession({ ...sessionUser, balance: result.balance });
      refreshHeader();
      await refreshHistory();
    } catch (error) {
      const failure = document.createElement("p");
      failure.className = "empty";
      failure.textContent = error.message;
      target.prepend(failure);
    }
  }

  try {
    await refreshHistory();
    window.setInterval(() => {
      refreshHistory().catch((error) => {
        target.replaceChildren();
        const failure = document.createElement("p");
        failure.className = "empty";
        failure.textContent = error.message;
        target.append(failure);
      });
    }, 5000);
  } catch (error) {
    const failure = document.createElement("p");
    failure.className = "empty";
    failure.textContent = error.message;
    target.append(failure);
  }
});
