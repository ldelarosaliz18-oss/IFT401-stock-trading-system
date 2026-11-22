document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  getSession()
    .then((session) => {
      if (session) window.location.replace("orders.html");
    })
    .catch((error) => showError(error.message));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
      showError("Enter your username and password.");
      return;
    }

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setSession(data.user);
      window.location.href = "orders.html";
    } catch (error) {
      showError(error.message);
    }
  });
});
