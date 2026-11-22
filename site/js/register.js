function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  getSession()
    .then((session) => {
      if (session) window.location.replace("orders.html");
    })
    .catch((error) => showError(error.message));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("");

    const f_name = form.f_name.value.trim();
    const l_name = form.l_name.value.trim();
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!f_name || !l_name || !username || !email || !password) {
      showError("Please fill out every field.");
      return;
    }

    if (!isValidEmail(email)) {
      showError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }

    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ f_name, l_name, username, email, password }),
      });
      setSession(data.user);
      window.location.href = "orders.html";
    } catch (error) {
      showError(error.message);
    }
  });
});
