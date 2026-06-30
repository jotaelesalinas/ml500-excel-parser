import { WeeklyInvestmentPolicy } from "../src/core/WeeklyInvestmentPolicy.js";

const BASE = { buyCount: 1, depositCash: 0, saleCash: 0, minDeposit: 1000, minInvestment: 100 };

describe("WeeklyInvestmentPolicy", () => {
  describe("no-op when buyCount <= 0", () => {
    it("returns zero allocation and passes through all state", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        buyCount: 0,
        depositCash: 500,
        saleCash: 300,
        strategy: "Full S",
        smoothBand: 2,
        smoothWeeksRemaining: 3,
        lastSaleReinvestment: 100,
      });

      expect(result.investedToday).toBe(0);
      expect(result.depositTopUp).toBe(0);
      expect(result.nextDepositCash).toBe(500);
      expect(result.nextSaleCash).toBe(300);
      expect(result.nextSmoothBand).toBe(2);
      expect(result.nextSmoothWeeksRemaining).toBe(3);
      expect(result.nextLastSaleReinvestment).toBe(100);
    });
  });

  // ── Group 1: Fixed ──────────────────────────────────────────────────────────

  describe("Fixed D", () => {
    it("always uses deposits, never touches saleCash", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 1300, strategy: "Fixed D" });

      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(0);
      expect(result.nextSaleCash).toBe(1300);
    });
  });

  describe("Fixed S|D", () => {
    it("uses sale cash for the weekly minimum when enough is available", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 1300, strategy: "Fixed S|D" });

      expect(result.depositTopUp).toBe(0);
      expect(result.investedFromDeposits).toBe(0);
      expect(result.investedFromSales).toBe(100);
      expect(result.nextSaleCash).toBe(1200);
    });

    it("falls back to deposits when sale cash is below the weekly minimum", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 50, strategy: "Fixed S|D" });

      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(0);
      expect(result.nextSaleCash).toBe(50);
    });
  });

  // ── Group 2: Full ───────────────────────────────────────────────────────────

  describe("Full S", () => {
    it("reinvests all sale cash in minimum-investment multiples, no deposit used", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 1300, strategy: "Full S" });

      expect(result.depositTopUp).toBe(0);
      expect(result.investedFromDeposits).toBe(0);
      expect(result.investedFromSales).toBe(1300);
      expect(result.nextSaleCash).toBe(0);
    });

    it("floors sale reinvestment to a multiple of min when not exact", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 1350, strategy: "Full S" });

      expect(result.investedFromSales).toBe(1300);
      expect(result.nextSaleCash).toBe(50);
    });

    it("falls back to deposits when sale cash is below the minimum investment", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 50, strategy: "Full S" });

      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(0);
    });
  });

  describe("Fixed D + Full S", () => {
    it("always invests the weekly minimum from deposits AND reinvests all sale cash", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 1300, strategy: "Fixed D + Full S" });

      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(1300);
      expect(result.targetToBuy).toBe(1400);
    });

    it("invests only the deposit base when no sale cash is available", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 0, strategy: "Fixed D + Full S" });

      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(0);
    });
  });

  // ── Group 3: Smooth ─────────────────────────────────────────────────────────

  describe("Smooth S", () => {
    it("starts a cycle and invests band × min per week (N=4, saleCash=837 → weekly=200)", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 837,
        strategy: "Smooth S",
        smoothN: 4,
        smoothBand: 0,
        smoothWeeksRemaining: 0,
      });

      expect(result.investedFromSales).toBe(200);
      expect(result.nextSmoothBand).toBe(2);
      expect(result.nextSmoothWeeksRemaining).toBe(3);
      expect(result.nextSaleCash).toBe(637);
    });

    it("continues the cycle without reset when saleCash stays in the same band", () => {
      const policy = new WeeklyInvestmentPolicy();
      // Ongoing cycle: band=2, weekly=200, 3 weeks remaining, current saleCash=637
      const result = policy.decide({
        ...BASE,
        saleCash: 637,
        strategy: "Smooth S",
        smoothN: 4,
        smoothBand: 2,
        smoothWeeksRemaining: 3,
      });

      expect(result.investedFromSales).toBe(200);
      expect(result.nextSmoothBand).toBe(2);
      expect(result.nextSmoothWeeksRemaining).toBe(2);
    });

    it("resets mid-cycle when a new sale pushes saleCash into a higher band", () => {
      const policy = new WeeklyInvestmentPolicy();
      // Ongoing band=1 cycle (weekly=100), saleCash jumps from 770 to 810 (band 2)
      const result = policy.decide({
        ...BASE,
        saleCash: 810,
        strategy: "Smooth S",
        smoothN: 4,
        smoothBand: 1,
        smoothWeeksRemaining: 2,
      });

      expect(result.nextSmoothBand).toBe(2);
      expect(result.nextSmoothWeeksRemaining).toBe(3);
      expect(result.investedFromSales).toBe(200);
    });

    it("does NOT reset when a small sale keeps saleCash in the same band", () => {
      const policy = new WeeklyInvestmentPolicy();
      // Band=1 cycle, saleCash goes from 770 to 790 (still band 1)
      const result = policy.decide({
        ...BASE,
        saleCash: 790,
        strategy: "Smooth S",
        smoothN: 4,
        smoothBand: 1,
        smoothWeeksRemaining: 2,
      });

      expect(result.nextSmoothBand).toBe(1);
      expect(result.investedFromSales).toBe(100);
    });

    it("falls back to deposits when saleCash is below N × min", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 37,
        strategy: "Smooth S",
        smoothN: 4,
        smoothBand: 0,
        smoothWeeksRemaining: 0,
      });

      expect(result.investedFromSales).toBe(0);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.nextSmoothBand).toBe(0);
      expect(result.nextSmoothWeeksRemaining).toBe(0);
    });
  });

  describe("Fixed D + Smooth S", () => {
    it("always invests the deposit base AND applies smooth reinvestment on top", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 837,
        strategy: "Fixed D + Smooth S",
        smoothN: 4,
        smoothBand: 0,
        smoothWeeksRemaining: 0,
      });

      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(200);
      expect(result.targetToBuy).toBe(300);
    });
  });

  // ── Group 4: Half ───────────────────────────────────────────────────────────

  describe("Half S", () => {
    it("reinvests 50% of sale cash (floored to nearest min)", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 500, strategy: "Half S" });

      // 50% of 500 = 250, floor(250/100)*100 = 200
      expect(result.investedFromSales).toBe(200);
      expect(result.investedFromDeposits).toBe(0);
      expect(result.nextSaleCash).toBe(300);
    });

    it("falls back to deposits when 50% of saleCash is below the minimum investment", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 150, strategy: "Half S" });

      // 50% of 150 = 75 < 100 min → fall back
      expect(result.investedFromSales).toBe(0);
      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
    });
  });

  describe("Fixed D + Half S", () => {
    it("always invests the deposit base AND reinvests 50% of sale cash", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, saleCash: 500, strategy: "Fixed D + Half S" });

      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(200);
      expect(result.targetToBuy).toBe(300);
    });
  });

  // ── Group 5: Doubling ───────────────────────────────────────────────────────

  describe("Doubling S", () => {
    it("starts reinvestment at minimum investment when no prior memory", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 200,
        strategy: "Doubling S",
        lastSaleReinvestment: 0,
      });

      expect(result.investedFromSales).toBe(100);
      expect(result.nextLastSaleReinvestment).toBe(100);
    });

    it("doubles the previous reinvestment, halving until it fits available sale cash", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 500,
        strategy: "Doubling S",
        lastSaleReinvestment: 400,
      });

      // candidate = 800 → too big → halve → 400 ≤ 500, invest 400
      expect(result.investedFromSales).toBe(400);
      expect(result.nextLastSaleReinvestment).toBe(400);
      expect(result.nextSaleCash).toBe(100);
    });

    it("resets memory to zero when sale cash is below minimum investment", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 50,
        strategy: "Doubling S",
        lastSaleReinvestment: 200,
      });

      expect(result.investedFromSales).toBe(0);
      expect(result.nextLastSaleReinvestment).toBe(0);
      expect(result.depositTopUp).toBe(1000);
      expect(result.investedFromDeposits).toBe(100);
    });
  });

  describe("Fixed D + Doubling S", () => {
    it("always invests the deposit base AND applies doubling reinvestment from sales", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        saleCash: 200,
        strategy: "Fixed D + Doubling S",
        lastSaleReinvestment: 0,
      });

      expect(result.investedFromDeposits).toBe(100);
      expect(result.investedFromSales).toBe(100);
      expect(result.targetToBuy).toBe(200);
      expect(result.nextLastSaleReinvestment).toBe(100);
    });
  });

  // ── Cross-cutting: rounding when splitting across multiple positions ─────────

  describe("rounding across multiple positions", () => {
    it("floors per-position amount and does not over-invest", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({ ...BASE, buyCount: 3, saleCash: 0, strategy: "Fixed D" });

      // targetToBuy=100, 3 positions → investedByPosition=33, investedToday=99
      expect(result.investedByPosition).toBe(33);
      expect(result.investedToday).toBe(99);
      expect(result.investedFromDeposits).toBe(99);
    });

    it("supports multiple top-ups when min deposit is smaller than min investment", () => {
      const policy = new WeeklyInvestmentPolicy();
      const result = policy.decide({
        ...BASE,
        depositCash: 100,
        minDeposit: 300,
        minInvestment: 1000,
        strategy: "Fixed D",
      });

      expect(result.depositTopUp).toBe(900);
      expect(result.investedToday).toBe(1000);
    });
  });
});
