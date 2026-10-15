document.addEventListener("DOMContentLoaded", () => {
  if (getSession()) {
    window.location.replace("orders.html");
    return;
  }

  const form = document.getElementById("login-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
      showError("Enter your username and password.");
      return;
    }

    const user = findUser(username);
    if (!user || user.password !== password) {
      showError("Username or password is incorrect.");
      return;
    }

    setSession(user);
    window.location.href = "orders.html";
  });
});
