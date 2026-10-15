const USERS_KEY = "stocktrade_users";
const SESSION_KEY = "stocktrade_session";
const STARTING_CASH = 100000;

function money(value) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getAccount() {
  const session = getSession();
  if (!session) return null;

  const users = getUsers();
  const index = users.findIndex(
    (user) => user.username.toLowerCase() === session.username.toLowerCase()
  );
  const stored = index >= 0 ? users[index] : session;
  const cash = typeof stored.cash === "number" ? stored.cash : STARTING_CASH;

  if (index >= 0 && stored.cash !== cash) {
    users[index] = { ...stored, cash };
    saveUsers(users);
  }

  if (session.cash !== cash) {
    setSession({ ...session, cash });
  }

  return { cash };
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function setSession(user) {
  const { password, ...safe } = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function findUser(username) {
  const key = username.trim().toLowerCase();
  return getUsers().find((user) => user.username.toLowerCase() === key);
}

function showError(message) {
  const el = document.getElementById("form-error");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
}

function wirePasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      button.querySelector(".icon-eye")?.classList.toggle("hidden", !showing);
      button.querySelector(".icon-eye-off")?.classList.toggle("hidden", showing);
    });
  });
}

document.addEventListener("DOMContentLoaded", wirePasswordToggles);
