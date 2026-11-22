let sessionUser = null;
let sessionRequest = null;

function money(value) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

async function getSession() {
  if (sessionUser) return sessionUser;
  if (!sessionRequest) {
    sessionRequest = apiRequest("/auth/session")
      .then((data) => {
        sessionUser = data.user;
        return sessionUser;
      })
      .catch((error) => {
        if (error.message.includes("sign in") || error.message.includes("session has expired")) {
          return null;
        }
        throw error;
      })
      .finally(() => {
        sessionRequest = null;
      });
  }
  return sessionRequest;
}

function setSession(user) {
  sessionUser = user;
}

async function clearSession() {
  await apiRequest("/auth/logout", { method: "POST" });
  sessionUser = null;
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
