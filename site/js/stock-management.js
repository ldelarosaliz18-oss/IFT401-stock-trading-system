const WEEKDAYS = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
  { day: 3, name: "Wednesday" },
  { day: 4, name: "Thursday" },
  { day: 5, name: "Friday" },
];

let marketSchedule = null;
let marketClockBase = null;
let marketClockLoadedAt = 0;
let marketClockAvailable = false;

function showManagementMessage(message, isError = false) {
  const element = document.getElementById("management-message");
  element.hidden = !message;
  element.textContent = message || "";
  element.classList.toggle("bad", isError);
  element.classList.toggle("ok", Boolean(message && !isError));
}

function parseAmPmTime(timeValue, periodValue) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(timeValue);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (periodValue === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function setAmPmTime(timeId, periodId, timeValue) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeValue || "");
  if (!match) {
    document.getElementById(timeId).value = "";
    document.getElementById(periodId).value = "AM";
    return;
  }
  const hour = Number(match[1]);
  document.getElementById(timeId).value = `${hour % 12 || 12}:${match[2]}`;
  document.getElementById(periodId).value = hour < 12 ? "AM" : "PM";
}

function setMarketClockInputs(value) {
  const date = new Date(value);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, "0");
  const day = String(validDate.getDate()).padStart(2, "0");
  document.getElementById("market-clock-date").value = `${year}-${month}-${day}`;
  setAmPmTime(
    "market-clock-time",
    "market-clock-period",
    `${String(validDate.getHours()).padStart(2, "0")}:${String(validDate.getMinutes()).padStart(2, "0")}`
  );
}

function marketClockInstantFromInputs() {
  const time = parseAmPmTime(
    document.getElementById("market-clock-time").value,
    document.getElementById("market-clock-period").value
  );
  const dateValue = document.getElementById("market-clock-date").value;
  if (!time || !dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date;
}

function marketDateFor(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function renderStocks(stocks) {
  const body = document.getElementById("management-stock-list");
  body.replaceChildren();
  stocks.forEach((stock) => {
    const row = document.createElement("tr");
    [stock.symbol, stock.company_name].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    });

    const priceCell = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.className = "stock-edit-input";
    priceInput.type = "number";
    priceInput.min = "0.01";
    priceInput.step = "0.01";
    priceInput.required = true;
    priceInput.value = Number(stock.market_price).toFixed(2);
    priceInput.setAttribute("aria-label", `${stock.symbol} market price`);
    priceCell.append(priceInput);
    row.append(priceCell);

    const volumeCell = document.createElement("td");
    const volumeInput = document.createElement("input");
    volumeInput.className = "stock-edit-input";
    volumeInput.type = "number";
    volumeInput.min = "0";
    volumeInput.step = "1";
    volumeInput.required = true;
    volumeInput.value = String(stock.volume);
    volumeInput.setAttribute("aria-label", `${stock.symbol} available shares`);
    volumeCell.append(volumeInput);
    row.append(volumeCell);

    const actionCell = document.createElement("td");
    actionCell.className = "stock-actions";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn-primary stock-save-button";
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", async () => {
      if (!priceInput.reportValidity() || !volumeInput.reportValidity()) return;
      saveButton.disabled = true;
      try {
        await apiRequest(`/market/stocks/${stock.id}`, {
          method: "PUT",
          body: JSON.stringify({
            market_price: Number(priceInput.value),
            volume: Number(volumeInput.value),
          }),
        });
        renderStocks(await apiRequest("/market/stocks"));
        showManagementMessage(`${stock.symbol} market price and available shares updated.`);
      } catch (error) {
        showManagementMessage(error.message, true);
        saveButton.disabled = false;
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "stock-delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${stock.symbol}`);
    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        `Permanently delete ${stock.symbol} and all user holdings, orders, and trade history for it? This will not refund users or adjust account balances.`
      );
      if (!confirmed) return;

      saveButton.disabled = true;
      deleteButton.disabled = true;
      try {
        await apiRequest(`/market/stocks/${stock.id}`, { method: "DELETE" });
        renderStocks(await apiRequest("/market/stocks"));
        showManagementMessage(`${stock.symbol} and its related data were deleted.`);
      } catch (error) {
        showManagementMessage(error.message, true);
        saveButton.disabled = false;
        deleteButton.disabled = false;
      }
    });

    actionCell.append(saveButton, deleteButton);
    row.append(actionCell);
    body.append(row);
  });
}

function renderWeekdays() {
  const picker = document.getElementById("trading-days");
  const saveButton = document.getElementById("save-market-schedule");
  picker.replaceChildren();
  WEEKDAYS.forEach(({ day, name }) => {
    const label = document.createElement("label");
    label.className = "weekday-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(day);
    input.checked = marketSchedule.trading_days.includes(day);
    input.addEventListener("change", () => {
      const tradingDays = new Set(marketSchedule.trading_days);
      if (input.checked) tradingDays.add(day);
      else tradingDays.delete(day);
      marketSchedule.trading_days = [...tradingDays].sort((left, right) => left - right);
    });
    const text = document.createElement("span");
    text.textContent = name;
    label.append(input, text);
    picker.append(label);
  });
  picker.append(saveButton);
}

function holidayDateFromInput(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (year < 1 || day < 1 || day > daysInMonth) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function renderHolidayList() {
  const list = document.getElementById("holiday-list");
  list.replaceChildren();
  const upcoming = marketSchedule.holidays
    .filter((holiday) => holiday >= marketSchedule.current_market_date)
    .sort();
  if (!upcoming.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No upcoming holidays scheduled.";
    list.append(empty);
    return;
  }
  upcoming.forEach((holiday) => {
    const item = document.createElement("li");
    const formattedDate = new Date(`${holiday}T12:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const date = document.createElement("span");
    date.textContent = formattedDate;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "holiday-remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove holiday on ${formattedDate}`);
    removeButton.addEventListener("click", () => {
      marketSchedule.holidays = marketSchedule.holidays.filter((scheduled) => scheduled !== holiday);
      renderHolidayList();
      showManagementMessage("Holiday removed. Save Market Schedule to apply the change.");
    });
    item.append(date, removeButton);
    list.append(item);
  });
}

function populateSchedule(schedule) {
  const parsedDateTime = new Date(schedule.current_datetime);
  marketClockAvailable =
    typeof schedule.current_datetime === "string" &&
    !Number.isNaN(parsedDateTime.getTime()) &&
    typeof schedule.clock_overridden === "boolean";
  const currentDateTime = Number.isNaN(parsedDateTime.getTime()) ? new Date() : parsedDateTime;
  const currentMarketDate =
    typeof schedule.current_market_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(schedule.current_market_date)
      ? schedule.current_market_date
      : marketDateFor(currentDateTime, schedule.time_zone || "America/New_York");
  marketSchedule = {
    ...schedule,
    trading_days: [...schedule.trading_days],
    holidays: [...schedule.holidays],
    current_datetime: currentDateTime.toISOString(),
    current_market_date: currentMarketDate,
    clock_overridden: schedule.clock_overridden === true,
  };
  setAmPmTime("market-open", "market-open-period", schedule.opens_at);
  setAmPmTime("market-close", "market-close-period", schedule.closes_at);
  marketClockBase = marketSchedule.current_datetime;
  marketClockLoadedAt = Date.now();
  setMarketClockInputs(marketSchedule.current_datetime);
  ["market-clock-date", "market-clock-time", "market-clock-period"].forEach((id) => {
    document.getElementById(id).disabled = !marketClockAvailable;
  });
  const clockStatus = document.getElementById("market-clock-status");
  clockStatus.textContent = marketClockAvailable
    ? ""
    : "Restart the server to enable market clock controls.";
  clockStatus.hidden = marketClockAvailable;
  document.querySelector('#market-clock-form button[type="submit"]').disabled = !marketClockAvailable;
  document.getElementById("use-live-clock").disabled = !marketClockAvailable;
  window.updateMarketHeaderStatus?.(schedule.is_open);
  renderWeekdays();
  renderHolidayList();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const user = await requireSession();
    if (user && user.admin_acc !== true) {
      window.location.replace("dashboard.html");
      return;
    }
    if (!user) return;

    const [stocks, schedule] = await Promise.all([
      apiRequest("/market/stocks"),
      apiRequest("/market/schedule"),
    ]);
    renderStocks(stocks);
    populateSchedule(schedule);

    window.setInterval(() => {
      const inputs = [
        document.getElementById("market-clock-date"),
        document.getElementById("market-clock-time"),
        document.getElementById("market-clock-period"),
      ];
      if (inputs.includes(document.activeElement) || !marketClockBase) return;
      const currentTime = new Date(
        new Date(marketClockBase).getTime() + Date.now() - marketClockLoadedAt
      );
      setMarketClockInputs(currentTime);
    }, 30 * 1000);

    document.getElementById("stock-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        await apiRequest("/market/stocks", {
          method: "POST",
          body: JSON.stringify({
            symbol: data.get("symbol"),
            company_name: data.get("company_name"),
            initial_price: Number(data.get("initial_price")),
            volume: Number(data.get("volume")),
          }),
        });
        renderStocks(await apiRequest("/market/stocks"));
        form.reset();
        showManagementMessage("Stock created successfully.");
      } catch (error) {
        showManagementMessage(error.message, true);
      }
    });

    document.getElementById("market-schedule-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("save-market-schedule");
      const opensAt = parseAmPmTime(
        document.getElementById("market-open").value,
        document.getElementById("market-open-period").value
      );
      const closesAt = parseAmPmTime(
        document.getElementById("market-close").value,
        document.getElementById("market-close-period").value
      );
      if (!opensAt || !closesAt) {
        showManagementMessage("Enter valid market opening and closing times.", true);
        return;
      }
      button.disabled = true;
      try {
        const schedule = await apiRequest("/market/schedule", {
          method: "PUT",
          body: JSON.stringify({
            opens_at: opensAt,
            closes_at: closesAt,
            trading_days: marketSchedule.trading_days,
            holidays: marketSchedule.holidays,
          }),
        });
        populateSchedule(schedule);
        showManagementMessage("Market schedule saved.");
      } catch (error) {
        showManagementMessage(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById("add-holiday").addEventListener("click", () => {
      const input = document.getElementById("holiday-date");
      if (!input.reportValidity()) return;
      const holidayDate = holidayDateFromInput(input.value);
      if (!holidayDate) {
        showManagementMessage("Enter a valid date as MM/DD/YYYY.", true);
        return;
      }
      if (holidayDate < marketSchedule.current_market_date) {
        showManagementMessage("Choose a date on or after the current market date.", true);
        return;
      }
      if (marketSchedule.holidays.includes(holidayDate)) {
        showManagementMessage("That holiday is already scheduled.", true);
        return;
      }
      marketSchedule.holidays.push(holidayDate);
      marketSchedule.holidays.sort();
      input.value = "";
      renderHolidayList();
      showManagementMessage("Holiday added. Save Market Schedule to apply the change.");
    });

    document.getElementById("market-clock-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!marketClockAvailable || !event.currentTarget.reportValidity()) return;
      const selectedDateTime = marketClockInstantFromInputs();
      if (!selectedDateTime) {
        showManagementMessage("Enter a valid date and time.", true);
        return;
      }
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const schedule = await apiRequest("/market/clock", {
          method: "PUT",
          body: JSON.stringify({
            current_datetime: selectedDateTime.toISOString(),
          }),
        });
        populateSchedule(schedule);
        showManagementMessage("Market date and time updated.");
      } catch (error) {
        showManagementMessage(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById("use-live-clock").addEventListener("click", async (event) => {
      if (!marketClockAvailable) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const schedule = await apiRequest("/market/clock", {
          method: "PUT",
          body: JSON.stringify({ current_datetime: null }),
        });
        populateSchedule(schedule);
        showManagementMessage("Market clock is using current time.");
      } catch (error) {
        showManagementMessage(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

  } catch (error) {
    showManagementMessage(error.message, true);
  }
});
