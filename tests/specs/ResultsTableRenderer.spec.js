import { ResultsTableRenderer } from "../../src/renderers/ResultsTableRenderer.js";

describe("ResultsTableRenderer", () => {
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
});
