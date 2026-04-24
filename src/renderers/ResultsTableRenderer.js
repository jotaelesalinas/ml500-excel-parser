export class ResultsTableRenderer {
    render(results, container) {
        if (results.length === 0) {
            container.innerHTML = "<p>No results.</p>";
            return;
        }

        let html = `<table>
            <thead><tr>
                <th>Top N</th>
                <th>Tab</th>
                <th>Deposited</th>
                <th>Current</th>
                <th>Invested</th>
                <th>Cash</th>
                <th>Returns</th>
                <th>Avg Age (Y)</th>
                <th>XIRR</th>
            </tr></thead><tbody>`;

        for (const result of results) {
            html += `<tr>
                <td class="num">${result.topN}</td>
                <td>${result.tab}</td>
                <td class="num">${this.#formatCurrency(result.deposited)}</td>
                <td class="num">${this.#formatCurrency(result.current)}</td>
                <td class="num">${this.#formatCurrency(result.invested)}</td>
                <td class="num">${this.#formatCurrency(result.cash)}</td>
                <td class="num">${this.#formatPercentage(result.returns)}</td>
                <td class="num">${result.avgAgeY}</td>
                <td class="num">${this.#formatPercentage(result.xirr)}</td>
            </tr>`;
        }

        html += "</tbody></table>";
        container.innerHTML = html;
    }

    #formatCurrency(value) {
        return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    #formatPercentage(value) {
        return value === "N/A" ? "N/A" : `${value}%`;
    }
}
