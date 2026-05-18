import { ResultsTableView } from "../src/ui/ResultsTableView.js";

describe("ResultsTableView", () => {
  it("renders empty state", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);

    view.render([]);

    expect(container.innerHTML).toBe("<p>No results.</p>");
  });

  it("renders a result table", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);

    view.render([
      {
        top_n: 4,
        tab: "Tab A",
        XIRR: 12.34,
        avg_age_y: 1.2,
        deposited: 2000,
        current: 2200,
        invested: 1500,
        cash: 500,
        returns: 10,
      },
    ]);

    expect(container.innerHTML).toContain("<table>");
    expect(container.innerHTML).toContain("Tab A");
    expect(container.innerHTML).toContain("Current");
    expect(container.innerHTML).toContain("Returns");
    expect(container.innerHTML).toContain("12.34 %");
  });

  it("escapes HTML special characters in tab names", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);

    view.render([
      {
        top_n: 1,
        tab: '<script>alert("xss")</script>',
        XIRR: "N/A",
        avg_age_y: 0,
        deposited: 0,
        current: 0,
        invested: 0,
        cash: 0,
        returns: 0,
      },
    ]);

    expect(container.innerHTML).not.toContain("<script>");
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });
});
