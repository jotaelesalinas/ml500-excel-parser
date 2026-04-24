export class StatusView {
    constructor(element) {
        this.element = element;
    }

    show(message, type) {
        this.element.textContent = message;
        this.element.className = type;
    }

    clear() {
        this.element.className = "";
        this.element.textContent = "";
    }
}
