import { buildActionLogMarkup } from "../../src/ui/results/buildActionLogMarkup.js";

describe("buildActionLogMarkup", () => {
  it("renders grouped action log rows and escapes HTML", () => {
    const markup = buildActionLogMarkup({
      top_n: 4,
      tab: '<script>alert("xss")</script>',
      strat: "Fixed D",
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
          returns: 0,
        },
      ],
    });

    expect(markup).toContain("Action Log");
    expect(markup).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(markup).toContain("Deposit");
  });
});
