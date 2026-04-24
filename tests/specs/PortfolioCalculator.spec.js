import { FinancialMetrics } from "../../src/calculators/FinancialMetrics.js";
import { PortfolioCalculator } from "../../src/calculators/PortfolioCalculator.js";

describe("PortfolioCalculator", () => {
    it("includes Current and Returns and keeps Avg Age/XIRR for the end of the table contract", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        spyOn(metrics, "xirr").and.returnValue(0.1234);
        spyOn(metrics, "avgWeightedAge").and.returnValue(1.23);

        const calculator = new PortfolioCalculator(metrics, () => today);
        const tabs = [[
            {
                ticker: "AAA",
                nombre: "Alpha",
                fechac: "2024-01-01",
                cantidad: "2",
                precioc: "100",
                fechav: "",
                preciov: "",
                precioa: "150",
            },
        ], [], []];

        const [result] = calculator.calculate(tabs, [1]);

        expect(result.topN).toBe(1);
        expect(result.deposited).toBe(1000);
        expect(result.invested).toBe(300);
        expect(result.cash).toBe(800);
        expect(result.current).toBe(1100);
        expect(result.returns).toBe(10);
        expect(result.avgAgeY).toBe(1.23);
        expect(result.xirr).toBe(12.34);
    });

    it("returns N/A for Returns when there is no deposited amount", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        spyOn(metrics, "xirr").and.returnValue(0.05);

        const calculator = new PortfolioCalculator(metrics, () => today);
        const [result] = calculator.calculate([[], [], []], [1]);

        expect(result.deposited).toBe(0);
        expect(result.current).toBe(0);
        expect(result.returns).toBe("N/A");
    });
});
