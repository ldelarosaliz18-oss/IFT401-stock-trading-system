async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.replace("index.html");
    return null;
  }
  return session;
}

function displayName(session) {
  if (session.f_name || session.l_name) {
    return `${session.f_name || ""} ${session.l_name || ""}`.trim();
  }
  return session.username;
}

function updateMarketHeaderStatus(isOpen) {
  const appHeader = document.querySelector(".app-header");
  const headerMeta = document.querySelector(".header-meta");
  if (!headerMeta || !appHeader) return;
  appHeader.classList.add("market-status-visible");

  let status = document.getElementById("market-header-status");
  if (!status) {
    const buyingPower = headerMeta.querySelector(".buying-power");
    if (!buyingPower) return;

    let accountGroup = headerMeta.querySelector(".market-account-group");
    if (!accountGroup) {
      accountGroup = document.createElement("div");
      accountGroup.className = "market-account-group";
      headerMeta.insertBefore(accountGroup, buyingPower);
      accountGroup.append(buyingPower);
    }

    status = document.createElement("div");
    status.id = "market-header-status";
    status.className = "market-header-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const indicator = document.createElement("span");
    indicator.className = "market-header-indicator";
    indicator.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "market-header-label";
    status.append(indicator, label);
    accountGroup.insertBefore(status, buyingPower);
  }

  const state = typeof isOpen === "boolean" ? (isOpen ? "open" : "closed") : "unavailable";
  const label = state === "open"
    ? "Market Open"
    : state === "closed"
      ? "Market Closed"
      : "Market Status Unavailable";
  status.className = `market-header-status market-${state}`;
  status.querySelector(".market-header-label").textContent = label;
  status.setAttribute("aria-label", label);
  status.title = label;
}

window.updateMarketHeaderStatus = updateMarketHeaderStatus;

async function refreshMarketHeaderStatus() {
  try {
    const schedule = await apiRequest("/market/schedule");
    if (typeof schedule.is_open !== "boolean") {
      throw new Error("Market status was not provided.");
    }
    updateMarketHeaderStatus(schedule.is_open);
  } catch (error) {
    updateMarketHeaderStatus(null);
    const status = document.getElementById("market-header-status");
    if (status) status.title = error.message;
    console.error("Could not load market status:", error.message);
  }
}

function refreshHeader() {
  const session = sessionUser;
  if (!session) return;

  const name = document.getElementById("user-name");
  if (name) name.textContent = displayName(session);

  const power = document.getElementById("buying-power");
  if (power) power.textContent = money(session.balance);

  const nav = document.querySelector(".app-nav");
  if (nav && session.admin_acc === true && !nav.querySelector('[href="stock-management.html"]')) {
    const managementLink = document.createElement("a");
    managementLink.className = "nav-link";
    managementLink.href = "stock-management.html";
    managementLink.textContent = "Stock Management";
    nav.append(managementLink);
  }
  const managementLink = nav?.querySelector('[href="stock-management.html"]');
  if (managementLink && session.admin_acc !== true) {
    managementLink.remove();
  }
  managementLink?.classList.toggle(
    "active",
    window.location.pathname.endsWith("/stock-management.html")
  );
}

document.addEventListener("DOMContentLoaded", () => {
  requireSession()
    .then((session) => {
      if (!session) return;
      refreshHeader();
      refreshMarketHeaderStatus();
      window.setInterval(refreshMarketHeaderStatus, 60 * 1000);
      document.getElementById("sign-out")?.addEventListener("click", async () => {
        try {
          await clearSession();
          window.location.href = "index.html";
        } catch (error) {
          window.alert(error.message);
        }
      });
    })
    .catch((error) => window.alert(error.message));
});
