import { SheetIssueLog } from "../src/core/SheetIssueLog.js";

describe("SheetIssueLog", () => {
  it("prefixes every message with the tab name", () => {
    const log = new SheetIssueLog("Prices hist");

    log.add("the tab is empty.");

    expect(log.list()).toEqual(['"Prices hist": the tab is empty.']);
  });

  it("keeps the first messages of a kind and counts the rest", () => {
    const log = new SheetIssueLog("Prices hist", { maxPerKind: 2 });

    log.addCapped("unreadable price cell(s)", "row 2 is unreadable.");
    log.addCapped("unreadable price cell(s)", "row 3 is unreadable.");
    log.addCapped("unreadable price cell(s)", "row 4 is unreadable.");
    log.addCapped("unreadable price cell(s)", "row 5 is unreadable.");

    expect(log.list()).toEqual([
      '"Prices hist": row 2 is unreadable.',
      '"Prices hist": row 3 is unreadable.',
      '"Prices hist": and 2 more unreadable price cell(s).',
    ]);
  });

  it("counts each kind on its own and summarizes only the ones over the cap", () => {
    const log = new SheetIssueLog("Index hist", { maxPerKind: 1 });

    log.addCapped("bad date(s)", "row 2 has a bad date.");
    log.addCapped("bad date(s)", "row 3 has a bad date.");
    log.addCapped("bad value(s)", "row 4 has a bad value.");

    expect(log.list()).toEqual([
      '"Index hist": row 2 has a bad date.',
      '"Index hist": row 4 has a bad value.',
      '"Index hist": and 1 more bad date(s).',
    ]);
  });

  it("lists nothing when no problem was found", () => {
    expect(new SheetIssueLog("Prices hist").list()).toEqual([]);
  });
});
