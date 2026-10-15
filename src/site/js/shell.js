function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.replace("index.html");
    return null;
  }
  return session;
}

function displayName(session) {
  const user = findUser(session.username) || session;
  if (user.firstName || user.lastName) {
    return `${user.firstName || ""} ${user.lastName || ""}`.trim();
  }
  return session.username;
}

function refreshHeader() {
  const session = getSession();
  if (!session) return;

  const name = document.getElementById("user-name");
  if (name) name.textContent = displayName(session);

  const account = getAccount();
  const power = document.getElementById("buying-power");
  if (power && account) power.textContent = money(account.cash);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!requireSession()) return;
  refreshHeader();
  document.getElementById("sign-out")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
});
