import { StatusView } from "../../src/ui/StatusView.js";

describe("StatusView", () => {
    it("shows a message with the given class", () => {
        const element = document.createElement("div");
        const view = new StatusView(element);

        view.show("Loading", "info");

        expect(element.textContent).toBe("Loading");
        expect(element.className).toBe("info");
    });

    it("clears the message and class", () => {
        const element = document.createElement("div");
        element.textContent = "Error";
        element.className = "error";

        const view = new StatusView(element);
        view.clear();

        expect(element.textContent).toBe("");
        expect(element.className).toBe("");
    });
});
