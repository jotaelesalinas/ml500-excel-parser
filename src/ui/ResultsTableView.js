export class ResultsTableView {
  constructor(containerElement) {
    this.containerElement = containerElement;
  }

  render(results) {
    if (results.length === 0) {
      this.containerElement.innerHTML = "<p>No results.</p>";
      return;
    }

    let html = `<table>
        <thead><tr>
            <th>Top N</th><th>Tab</th><th>XIRR</th><th>Avg Age (Y)</th>
            <th>Deposited</th><th>Invested</th><th>Cash</th>
        </tr></thead><tbody>`;

    for (const result of results) {
      html += `<tr>
            <td class="num">${result.top_n}</td>
            <td>${result.tab}</td>
            <td class="num">${result.XIRR === "N/A" ? "N/A" : `${Number(result.XIRR).toFixed(2)} %`}</td>
            <td class="num">${result.avg_age_y}</td>
            <td class="num">${result.deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${result.invested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${result.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        </tr>`;
    }

    html += "</tbody></table>";
    this.containerElement.innerHTML = html;
  }
}
