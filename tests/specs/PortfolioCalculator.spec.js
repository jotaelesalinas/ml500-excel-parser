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

    it("includes sell movements in cash and passes the combined flows to xirr", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        spyOn(metrics, "xirr").and.returnValue(0.08);
        spyOn(metrics, "avgWeightedAge").and.returnValue(0.5);

        const calculator = new PortfolioCalculator(metrics, () => today);
        const [result] = calculator.calculate([[
            {
                ticker: "AAA",
                nombre: "Alpha",
                fechac: "2024-01-01",
                cantidad: "2",
                precioc: "100",
                fechav: "2024-01-05",
                preciov: "130",
                precioa: "",
            },
        ], [], []], [1]);

        expect(result.deposited).toBe(1000);
        expect(result.invested).toBe(0);
        expect(result.cash).toBe(1060);
        expect(result.current).toBe(1060);
        expect(result.returns).toBe(6);
        expect(metrics.xirr).toHaveBeenCalledWith([
            { date: "2024-01-01", amount: -1000 },
            { date: today, amount: 1060 },
        ]);
    });

    it("returns N/A for xirr when the metric calculation fails", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        spyOn(metrics, "xirr").and.throwError("XIRR did not converge.");
        spyOn(metrics, "avgWeightedAge").and.returnValue(1);
        spyOn(console, "warn");

        const calculator = new PortfolioCalculator(metrics, () => today);
        const [result] = calculator.calculate([[
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
        ], [], []], [1]);

        expect(result.xirr).toBe("N/A");
        expect(console.warn).toHaveBeenCalled();
    });

    it("throws when an entry is missing required buy data", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        const calculator = new PortfolioCalculator(metrics, () => today);

        expect(() => calculator.calculate([[
            {
                ticker: "AAA",
                nombre: "Alpha",
                fechac: "",
                cantidad: "2",
                precioc: "100",
                fechav: "",
                preciov: "",
                precioa: "150",
            },
        ], [], []], [1])).toThrowError(/Missing fechac, cantidad, or precioc/);
    });

    it("throws when sold entries also include current price data", () => {
        const today = "2024-01-10";
        const metrics = new FinancialMetrics(() => today);
        const calculator = new PortfolioCalculator(metrics, () => today);

        expect(() => calculator.calculate([[
            {
                ticker: "AAA",
                nombre: "Alpha",
                fechac: "2024-01-01",
                cantidad: "2",
                precioc: "100",
                fechav: "2024-01-05",
                preciov: "120",
                precioa: "130",
            },
        ], [], []], [1])).toThrowError(/Unexpected precioa with fechav and preciov/);
    });
});
