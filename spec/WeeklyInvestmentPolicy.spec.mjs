import { WeeklyInvestmentPolicy } from "../src/core/WeeklyInvestmentPolicy.js";

describe("WeeklyInvestmentPolicy", () => {
  it("returns a no-op allocation when there are no buys", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 0,
      depositCash: 500,
      saleCash: 300,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: true,
    });

    expect(result).toEqual({
      depositTopUp: 0,
      baseToBuy: 0,
      saleReinvestment: 0,
      targetToBuy: 0,
      investedByPosition: 0,
      investedToday: 0,
      investedFromDeposits: 0,
      investedFromSales: 0,
      nextDepositCash: 500,
      nextSaleCash: 300,
      nextLastSaleReinvestment: 0,
    });
  });

  it("uses sale cash first for the weekly minimum when reinvest is disabled", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 2,
      depositCash: 0,
      saleCash: 1300,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: false,
    });

    expect(result.depositTopUp).toBe(0);
    expect(result.baseToBuy).toBe(100);
    expect(result.saleReinvestment).toBe(0);
    expect(result.targetToBuy).toBe(100);
    expect(result.investedByPosition).toBe(50);
    expect(result.investedToday).toBe(100);
    expect(result.investedFromDeposits).toBe(0);
    expect(result.investedFromSales).toBe(100);
    expect(result.nextDepositCash).toBe(0);
    expect(result.nextSaleCash).toBe(1200);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });

  it("uses only deposits and top-up when sale cash is below weekly minimum", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 0,
      saleCash: 50,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: false,
    });

    expect(result.depositTopUp).toBe(1000);
    expect(result.investedToday).toBe(100);
    expect(result.investedFromSales).toBe(0);
    expect(result.investedFromDeposits).toBe(100);
    expect(result.nextDepositCash).toBe(900);
    expect(result.nextSaleCash).toBe(50);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });

  it("adds reinvestment from sales in minimum-investment multiples", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 0,
      saleCash: 1300,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: true,
    });

    expect(result.depositTopUp).toBe(1000);
    expect(result.baseToBuy).toBe(100);
    expect(result.saleReinvestment).toBe(1300);
    expect(result.targetToBuy).toBe(1400);
    expect(result.investedByPosition).toBe(1400);
    expect(result.investedToday).toBe(1400);
    expect(result.investedFromDeposits).toBe(100);
    expect(result.investedFromSales).toBe(1300);
    expect(result.nextDepositCash).toBe(900);
    expect(result.nextSaleCash).toBe(0);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });

  it("preserves the rounding-down behavior when splitting target across buys", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 3,
      depositCash: 0,
      saleCash: 0,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: false,
    });

    expect(result.targetToBuy).toBe(100);
    expect(result.investedByPosition).toBe(33);
    expect(result.investedToday).toBe(99);
    expect(result.investedFromDeposits).toBe(99);
    expect(result.nextDepositCash).toBe(901);
    expect(result.nextSaleCash).toBe(0);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });

  it("supports multiple top-ups when minimum deposit is below weekly minimum", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 100,
      saleCash: 0,
      minDeposit: 300,
      minInvestment: 1000,
      reinvest: false,
    });

    expect(result.depositTopUp).toBe(900);
    expect(result.targetToBuy).toBe(1000);
    expect(result.investedToday).toBe(1000);
    expect(result.nextDepositCash).toBe(0);
    expect(result.nextSaleCash).toBe(0);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });

  it("starts incremental sale reinvestment at minimum investment when enough sale cash is available", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 0,
      saleCash: 200,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: true,
      incremental: true,
      lastSaleReinvestment: 0,
    });

    expect(result.saleReinvestment).toBe(100);
    expect(result.investedFromSales).toBe(100);
    expect(result.nextLastSaleReinvestment).toBe(100);
  });

  it("doubles incremental reinvestment and halves until it fits available sale cash", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 0,
      saleCash: 500,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: true,
      incremental: true,
      lastSaleReinvestment: 400,
    });

    expect(result.saleReinvestment).toBe(400);
    expect(result.investedFromSales).toBe(400);
    expect(result.nextSaleCash).toBe(100);
    expect(result.nextLastSaleReinvestment).toBe(400);
  });

  it("resets incremental memory to zero when sale cash is below minimum investment", () => {
    const policy = new WeeklyInvestmentPolicy();

    const result = policy.decide({
      buyCount: 1,
      depositCash: 0,
      saleCash: 50,
      minDeposit: 1000,
      minInvestment: 100,
      reinvest: true,
      incremental: true,
      lastSaleReinvestment: 200,
    });

    expect(result.saleReinvestment).toBe(0);
    expect(result.investedFromSales).toBe(0);
    expect(result.nextLastSaleReinvestment).toBe(0);
  });
});
