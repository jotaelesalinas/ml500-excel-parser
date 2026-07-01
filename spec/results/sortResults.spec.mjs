import { sortResults } from "../../src/ui/results/sortResults.js";

describe("sortResults", () => {
  it("keeps the original order when unsorted", () => {
    const results = [{ tab: "B" }, { tab: "A" }];

    expect(sortResults(results, { field: null, direction: "asc", hasSorted: false })).toEqual(results);
  });

  it("sorts numerically with stable ties", () => {
    const results = [
      { tab: "A", returns: 10 },
      { tab: "B", returns: 10 },
      { tab: "C", returns: 5 },
    ];

    expect(sortResults(results, { field: "returns", direction: "asc", hasSorted: true }).map((result) => result.tab))
      .toEqual(["C", "A", "B"]);
  });

  it("sorts pl as current minus deposited", () => {
    const results = [
      { tab: "A", current: 1100, deposited: 1000 },
      { tab: "B", current: 1200, deposited: 1000 },
    ];

    expect(sortResults(results, { field: "pl", direction: "desc", hasSorted: true }).map((result) => result.tab))
      .toEqual(["B", "A"]);
  });
});
