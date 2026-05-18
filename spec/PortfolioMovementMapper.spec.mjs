import { PortfolioMovementMapper } from "../src/core/PortfolioMovementMapper.js";

describe("PortfolioMovementMapper", () => {
  it("maps buy and sell movements", () => {
    const mapper = new PortfolioMovementMapper(() => "2026-01-10");

    const result = mapper.map({
      ticker: "AAPL",
      nombre: "Apple",
      fechac: "2026-01-01",
      cantidad: "2",
      precioc: "100",
      fechav: "2026-01-05",
      preciov: "120",
      precioa: "",
    });

    expect(result[0]).toEqual(jasmine.objectContaining({
      action: "buy",
      date: "2026-01-01",
      ticker: "AAPL",
      amount: 200,
    }));
    expect(result[1]).toEqual(jasmine.objectContaining({
      action: "sell",
      date: "2026-01-05",
      ticker: "AAPL",
      amount: 240,
    }));
    expect(result[0].positionId).toBe(result[1].positionId);
  });

  it("maps buy and current value movements", () => {
    const mapper = new PortfolioMovementMapper(() => "2026-01-10");

    const result = mapper.map({
      ticker: "AAPL",
      nombre: "Apple",
      fechac: "2026-01-01",
      cantidad: "2",
      precioc: "100",
      fechav: "",
      preciov: "",
      precioa: "130",
    });

    expect(result[1].action).toBe("valueToday");
    expect(result[1].date).toBe("2026-01-10");
    expect(result[1].amount).toBe(260);
    expect(result[0].positionId).toBe(result[1].positionId);
  });

  it("assigns different position ids to different rows", () => {
    const mapper = new PortfolioMovementMapper(() => "2026-01-10");

    const first = mapper.map({
      ticker: "AAPL",
      nombre: "Apple",
      fechac: "2026-01-01",
      cantidad: "1",
      precioc: "100",
      fechav: "",
      preciov: "",
      precioa: "110",
    });

    const second = mapper.map({
      ticker: "MSFT",
      nombre: "Microsoft",
      fechac: "2026-01-01",
      cantidad: "1",
      precioc: "200",
      fechav: "",
      preciov: "",
      precioa: "220",
    });

    expect(first[0].positionId).not.toBe(second[0].positionId);
  });

  it("throws when both fechav/preciov and precioa are set", () => {
    const mapper = new PortfolioMovementMapper(() => "2026-01-10");

    expect(() =>
      mapper.map({
        ticker: "AAPL",
        nombre: "Apple",
        fechac: "2026-01-01",
        cantidad: "2",
        precioc: "100",
        fechav: "2026-01-05",
        preciov: "120",
        precioa: "130",
      }),
    ).toThrow();
  });

  it("parses precioc with thousands separator", () => {
    const mapper = new PortfolioMovementMapper(() => "2026-01-10");

    const result = mapper.map({
      ticker: "AAPL",
      nombre: "Apple",
      fechac: "2026-01-01",
      cantidad: "2",
      precioc: "1,500",
      fechav: "",
      preciov: "",
      precioa: "1,600",
    });

    expect(result[0].amount).toBe(3000);
  });

  it("throws when required fields are missing", () => {
    const mapper = new PortfolioMovementMapper();

    expect(() =>
      mapper.map({
        ticker: "",
        nombre: "",
        fechac: "",
        cantidad: "",
        precioc: "",
        fechav: "",
        preciov: "",
        precioa: "",
      }),
    ).toThrow();
  });
});
