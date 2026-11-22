function setQuantityInput(input, quantity) {
  input.value = String(quantity);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function wireQuantityShortcuts(containerId, input, onMax, onError) {
  document.querySelectorAll(`#${containerId} [data-quantity]`).forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.quantity === "clear") {
        setQuantityInput(input, 0);
        input.focus();
        return;
      }
      if (button.dataset.quantity !== "max") {
        setQuantityInput(input, Number(button.dataset.quantity));
        return;
      }

      button.disabled = true;
      try {
        const quantity = await onMax(button.dataset.side);
        setQuantityInput(input, quantity);
      } catch (error) {
        onError(error);
      } finally {
        button.disabled = false;
      }
    });
  });
}
