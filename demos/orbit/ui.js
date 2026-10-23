globalThis.OrbitUI = {
  node(tag, cls, text) {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  },
  button(text, action, cls = "button secondary") {
    const element = this.node("button", cls, text);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  },
  confirmAction(message) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const popup = this.node("dialog", "confirm-dialog");
      popup.setAttribute("aria-label", "Подтвердите действие");
      popup.append(
        this.node("h2", "", "Подтвердите действие"),
        this.node("p", "muted", message),
      );
      const actions = this.node("div", "form-actions");
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        popup.close();
        popup.remove();
        if (previous?.isConnected) previous.focus();
        resolve(value);
      };
      actions.append(
        this.button("Отмена", () => finish(false)),
        this.button("Подтвердить", () => finish(true), "button danger"),
      );
      popup.append(actions);
      popup.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(false);
      });
      document.body.append(popup);
      popup.showModal();
      actions.firstChild.focus();
    });
  },
};
