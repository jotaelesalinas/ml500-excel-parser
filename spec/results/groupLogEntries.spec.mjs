import { groupLogEntries } from "../../src/ui/results/groupLogEntries.js";

describe("groupLogEntries", () => {
  it("groups buy rows by day and ticker", () => {
    const grouped = groupLogEntries([
      { date: "2026-01-01", action: "Buy AAA", qty: 1, amount: 100, deposited: 0, current: 0, invested: 100, depositCash: 0, saleCash: 0, returns: 0 },
      { date: "2026-01-01", action: "Buy AAA", qty: 2, amount: 200, deposited: 0, current: 0, invested: 300, depositCash: 0, saleCash: 0, returns: 0 },
    ]);

    expect(grouped).toEqual([
      { date: "2026-01-01", action: "Buy AAA", qty: 3, amount: 300, deposited: 0, current: 0, invested: 300, depositCash: 0, saleCash: 0, returns: 0 },
    ]);
  });

  it("keeps non buy/sell rows untouched", () => {
    const entry = { date: "2026-01-02", action: "Final snapshot", qty: null, amount: 0 };

    expect(groupLogEntries([entry])).toEqual([entry]);
  });
});
