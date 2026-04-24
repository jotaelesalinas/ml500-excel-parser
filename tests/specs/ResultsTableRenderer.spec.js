import { ResultsTableRenderer } from "../../src/renderers/ResultsTableRenderer.js";

describe("ResultsTableRenderer", () => {
    it("renders a fallback message when there are no results", () => {
        const renderer = new ResultsTableRenderer();
        const container = document.createElement("div");

        renderer.render([], container);

        expect(container.innerHTML).toContain("No results.");
    });

    it("renders the columns in the requested order", () => {
        const renderer = new ResultsTableRenderer();
        const container = document.createElement("div");

        renderer.render([{
            topN: 4,
            tab: "Sample Tab",
            deposited: 1000,
            invested: 900,
            current: 950,
            cash: 50,
            returns: -5,
            avgAgeY: 2.2,
            xirr: 7.5,
        }], container);

        const headers = Array.from(container.querySelectorAll("th")).map(header => header.textContent.trim());

        expect(headers).toEqual([
            "Top N",
            "Tab",
            "Deposited",
            "Current",
            "Invested",
            "Cash",
            "Returns",
            "Avg Age (Y)",
            "XIRR",
        ]);
    });

    it("formats currencies and percentages in the table body", () => {
        const renderer = new ResultsTableRenderer();
        const container = document.createElement("div");

        renderer.render([{
            topN: 4,
            tab: "Sample Tab",
            deposited: 1000,
            invested: 900.5,
            current: 950.25,
            cash: 49.75,
            returns: "N/A",
            avgAgeY: 2.2,
            xirr: 7.5,
        }], container);

        const cells = Array.from(container.querySelectorAll("tbody td")).map(cell => cell.textContent.trim());

        expect(cells).toEqual([
            "4",
            "Sample Tab",
            "1,000.00",
            "950.25",
            "900.50",
            "49.75",
            "N/A",
            "2.2",
            "7.5%",
        ]);
    });
});
