import { SessionSeries } from "../src/core/SessionSeries.js";

describe("SessionSeries", () => {
  const series = new SessionSeries([
    { date: "2025-01-10", value: 110 },
    { date: "2025-01-06", value: 100 },
    { date: "2025-01-08", value: 90 },
  ]);

  it("sorts sessions chronologically and ignores unusable entries", () => {
    const withNoise = new SessionSeries([
      { date: "2025-01-08", value: 90 },
      { date: "2025-01-06", value: 100 },
      { date: "2025-01-07", value: Number.NaN },
      { date: null, value: 50 },
      null,
    ]);

    expect(withNoise.sessions).toEqual([
      { date: "2025-01-06", value: 100 },
      { date: "2025-01-08", value: 90 },
    ]);
    expect(withNoise.length).toBe(2);
    expect(withNoise.isEmpty()).toBeFalse();
    expect(new SessionSeries().isEmpty()).toBeTrue();
  });

  it("keeps the first value when a date is repeated", () => {
    const duplicated = new SessionSeries([
      { date: "2025-01-06", value: 100 },
      { date: "2025-01-06", value: 999 },
    ]);

    expect(duplicated.sessions).toEqual([{ date: "2025-01-06", value: 100 }]);
  });

  it("resolves the session covering a non-trading day", () => {
    expect(series.sessionAtOrBefore("2025-01-09")).toEqual({ date: "2025-01-08", value: 90 });
    expect(series.sessionAtOrBefore("2025-01-08")).toEqual({ date: "2025-01-08", value: 90 });
    expect(series.sessionAtOrBefore("2025-01-05")).toBeNull();
    expect(series.indexAtOrBefore("2025-01-05")).toBe(-1);
    expect(series.lastSession()).toEqual({ date: "2025-01-10", value: 110 });
    expect(new SessionSeries().lastSession()).toBeNull();
  });

  it("lists the sessions after a date, excluding that date", () => {
    expect(series.sessionsAfter("2025-01-06")).toEqual([
      { date: "2025-01-08", value: 90 },
      { date: "2025-01-10", value: 110 },
    ]);
    expect(series.sessionsAfter("2025-01-07")).toEqual([
      { date: "2025-01-08", value: 90 },
      { date: "2025-01-10", value: 110 },
    ]);
    expect(series.sessionsAfter("2025-01-10")).toEqual([]);
  });

  it("measures the change against N sessions earlier, skipping closed days", () => {
    expect(series.changePctOverSessions("2025-01-10", 1)).toBeCloseTo(22.22, 2);
    expect(series.changePctOverSessions("2025-01-10", 2)).toBeCloseTo(10, 6);
    expect(series.changePctOverSessions("2025-01-08", 1)).toBeCloseTo(-10, 6);
    // A Saturday reads the Friday session, so it compares 2025-01-10 with 2025-01-08.
    expect(series.changePctOverSessions("2025-01-11", 1)).toBeCloseTo(22.22, 2);
  });

  it("returns null when there is not enough history to compare", () => {
    expect(series.changePctOverSessions("2025-01-10", 3)).toBeNull();
    expect(series.changePctOverSessions("2025-01-05", 1)).toBeNull();
    expect(series.changePctOverSessions("2025-01-10", 0)).toBeNull();
    expect(
      new SessionSeries([
        { date: "2025-01-06", value: 0 },
        { date: "2025-01-07", value: 10 },
      ]).changePctOverSessions("2025-01-07", 1),
    ).toBeNull();
  });
});
