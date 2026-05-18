import { StatusView } from "../src/ui/StatusView.js";

describe("StatusView", () => {
  it("shows message and class", () => {
    const element = { textContent: "", className: "" };
    const view = new StatusView(element);

    view.show("Hello", "info");

    expect(element.textContent).toBe("Hello");
    expect(element.className).toBe("info");
  });

  it("clears message and class", () => {
    const element = { textContent: "x", className: "error" };
    const view = new StatusView(element);

    view.clear();

    expect(element.textContent).toBe("");
    expect(element.className).toBe("");
  });
});
