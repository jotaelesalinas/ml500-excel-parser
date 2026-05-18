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
        depositCash: 300,
        saleCash: 200,
        cash: 500,
        returns: 10,
      },
    ]);

    expect(container.innerHTML).toContain("<table>");
    expect(container.innerHTML).toContain("Tab A");
    expect(container.innerHTML).toContain('class="tab-log-link"');
    expect(container.innerHTML).toContain("Current");
    expect(container.innerHTML).toContain("P/L %");
    expect(container.innerHTML).toContain("Age (Y)");
    expect(container.innerHTML).toContain("Deposit $$");
    expect(container.innerHTML).toContain("Sale $$");
    expect(container.innerHTML).toContain("12.34 %");
  });

  it("renders selected tab action log", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);
    const result = {
      top_n: 4,
      tab: "Tab A",
      XIRR: 12.34,
      avg_age_y: 1.2,
      deposited: 2000,
      current: 2200,
      invested: 1500,
      depositCash: 300,
      saleCash: 200,
      cash: 500,
      returns: 10,
    };
    Object.defineProperty(result, "log", {
      value: [
        {
          date: "2026-01-01",
          action: "Deposit",
          qty: null,
          amount: 1000,
          deposited: 1000,
          current: 1000,
          invested: 0,
          depositCash: 1000,
          saleCash: 0,
          cash: 1000,
          returns: 0,
        },
      ],
      enumerable: false,
    });

    view.selectedResultKey = "4::Tab A::0";
    view.render([result]);

    expect(container.innerHTML).toContain("Action Log");
    expect(container.innerHTML).toContain("<th>Date</th>");
    expect(container.innerHTML).toContain("Deposit");
    expect(container.innerHTML).toContain("<th>Deposit $$</th>");
    expect(container.innerHTML).toContain("<th>Sale $$</th>");
    expect(container.innerHTML).toContain("<th>P/L</th>");
    expect(container.innerHTML).toContain("<th>P/L %</th>");
  });

  it("hides selected tab action log after clearing selection", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);
    const result = {
      top_n: 4,
      tab: "Tab A",
      XIRR: 12.34,
      avg_age_y: 1.2,
      deposited: 2000,
      current: 2200,
      invested: 1500,
      depositCash: 300,
      saleCash: 200,
      cash: 500,
      returns: 10,
      log: [
        {
          date: "2026-01-01",
          action: "Deposit",
          qty: null,
          amount: 1000,
          deposited: 1000,
          current: 1000,
          invested: 0,
          depositCash: 1000,
          saleCash: 0,
          cash: 1000,
          returns: 0,
        },
      ],
    };

    view.selectedResultKey = "4::Tab A::0";
    view.clearSelection();
    view.render([result]);

    expect(container.innerHTML).not.toContain("Action Log");
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
        depositCash: 0,
        saleCash: 0,
        cash: 0,
        returns: 0,
      },
    ]);

    expect(container.innerHTML).not.toContain("<script>");
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });

  it("groups buy rows by day+ticker and leaves final snapshot amount empty", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);
    const result = {
      top_n: 2,
      tab: "Tab Group",
      XIRR: 1,
      avg_age_y: 1,
      deposited: 1000,
      current: 1050,
      invested: 800,
      depositCash: 200,
      saleCash: 50,
      cash: 250,
      returns: 5,
    };
    Object.defineProperty(result, "log", {
      value: [
        {
          date: "2026-01-01",
          action: "Buy AAA",
          qty: 1,
          amount: 100,
          deposited: 1000,
          current: 1000,
          invested: 100,
          depositCash: 900,
          saleCash: 0,
          cash: 900,
          returns: 0,
        },
        {
          date: "2026-01-01",
          action: "Buy AAA",
          qty: 2,
          amount: 200,
          deposited: 1000,
          current: 1000,
          invested: 300,
          depositCash: 700,
          saleCash: 0,
          cash: 700,
          returns: 0,
        },
        {
          date: "2026-01-02",
          action: "Final snapshot",
          qty: null,
          amount: 0,
          deposited: 1000,
          current: 1050,
          invested: 800,
          depositCash: 200,
          saleCash: 50,
          cash: 250,
          returns: 5,
        },
      ],
      enumerable: false,
    });

    view.selectedResultKey = "2::Tab Group::0";
    view.render([result]);

    expect(container.innerHTML).toContain(">Buy AAA</td>");
    expect(container.innerHTML).toContain(">3</td>");
    expect(container.innerHTML).toContain(">300.00</td>");
    expect(container.innerHTML).not.toContain("Final snapshot</td>\n        <td class=\"num\">0.00</td>");
  });

  it("applies soft row classes by action type and keeps qty empty for diff rows", () => {
    const container = { innerHTML: "" };
    const view = new ResultsTableView(container);
    const result = {
      top_n: 3,
      tab: "Tab Style",
      XIRR: 1,
      avg_age_y: 1,
      deposited: 1000,
      current: 1050,
      invested: 850,
      depositCash: 200,
      saleCash: 0,
      cash: 200,
      returns: 5,
    };
    Object.defineProperty(result, "log", {
      value: [
        {
          date: "2026-01-01",
          action: "Deposit",
          qty: null,
          amount: 1000,
          deposited: 1000,
          current: 1000,
          invested: 0,
          depositCash: 1000,
          saleCash: 0,
          cash: 1000,
          returns: 0,
        },
        {
          date: "2026-01-02",
          action: "Buy AAA",
          qty: 2,
          amount: 400,
          deposited: 1000,
          current: 1000,
          invested: 400,
          depositCash: 600,
          saleCash: 0,
          cash: 600,
          returns: 0,
        },
        {
          date: "2026-01-03",
          action: "Sell AAA",
          qty: 1,
          amount: 250,
          deposited: 1000,
          current: 1020,
          invested: 200,
          depositCash: 600,
          saleCash: 250,
          cash: 850,
          returns: 2,
        },
        {
          date: "2026-01-04",
          action: "Diff AAA",
          qty: null,
          amount: 50,
          deposited: 1000,
          current: 1050,
          invested: 250,
          depositCash: 600,
          saleCash: 200,
          cash: 800,
          returns: 5,
        },
      ],
      enumerable: false,
    });

    view.selectedResultKey = "3::Tab Style::0";
    view.render([result]);

    expect(container.innerHTML).toContain('class="log-row-type-deposit"');
    expect(container.innerHTML).toContain('class="log-row-type-buy"');
    expect(container.innerHTML).toContain('class="log-row-type-sell"');
    expect(container.innerHTML).toContain('class="log-row-type-diff"');
    expect(container.innerHTML).toContain(">Diff AAA</td>");
    expect(container.innerHTML).toContain(">Diff AAA</td>\n        <td class=\"num\"></td>");
  });
});
