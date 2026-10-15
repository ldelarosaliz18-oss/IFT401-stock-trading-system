function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

document.addEventListener("DOMContentLoaded", () => {
  if (getSession()) {
    window.location.replace("orders.html");
    return;
  }

  const form = document.getElementById("register-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");

    const firstName = form.firstName.value.trim();
    const lastName = form.lastName.value.trim();
    const username = form.username.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!firstName || !lastName || !username || !email || !password) {
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

    const users = getUsers();
    const usernameTaken = users.some(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
    const emailTaken = users.some(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );

    if (usernameTaken) {
      showError("That username is already taken.");
      return;
    }

    if (emailTaken) {
      showError("An account with that email already exists.");
      return;
    }

    const user = {
      firstName,
      lastName,
      username,
      email,
      password,
      cash: STARTING_CASH,
      createdAt: Date.now(),
    };

    users.push(user);
    saveUsers(users);
    setSession(user);
    window.location.href = "orders.html";
  });
});
