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
        invested: 1500,
        cash: 500,
      },
    ]);

    expect(container.innerHTML).toContain("<table>");
    expect(container.innerHTML).toContain("Tab A");
    expect(container.innerHTML).toContain("12.34 %");
  });
});
