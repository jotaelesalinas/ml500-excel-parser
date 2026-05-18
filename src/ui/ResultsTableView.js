export class ResultsTableView {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.results = [];
    this.selectedResultKey = null;
  }

  render(results) {
    this.results = results;
    if (results.length === 0) {
      this.containerElement.innerHTML = "<p>No results.</p>";
      this.selectedResultKey = null;
      return;
    }

    const selectedResult = this.#getSelectedResult(results);

    let html = `<table>
        <thead><tr>
            <th>Top N</th><th>Tab</th><th>Deposited</th><th>Current</th>
            <th>Invested</th><th>Deposit $$</th><th>Sale $$</th><th>P/L</th><th>P/L %</th><th>Age (Y)</th><th>XIRR</th>
        </tr></thead><tbody>`;

    results.forEach((result, index) => {
      const rowKey = this.#buildResultKey(result, index);
      const pl = Number(result.current) - Number(result.deposited);
      html += `<tr>
            <td class="num">${result.top_n}</td>
            <td><a href="#" class="tab-log-link" data-result-key="${this.#escapeHtml(rowKey)}">${this.#escapeHtml(result.tab)}</a></td>
            <td class="num">${result.deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${result.current.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${result.invested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num">${this.#formatAmount(result.depositCash)}</td>
            <td class="num">${this.#formatAmount(result.saleCash)}</td>
            <td class="num">${this.#formatAmount(pl)}</td>
            <td class="num">${Number(result.returns).toFixed(2)} %</td>
            <td class="num">${result.avg_age_y}</td>
            <td class="num">${result.XIRR === "N/A" ? "N/A" : `${Number(result.XIRR).toFixed(2)} %`}</td>
        </tr>`;
    });

    html += "</tbody></table>";
    html += this.#buildLogTable(selectedResult);
    this.containerElement.innerHTML = html;
    this.#bindTabLinkEvents();
  }

  #getSelectedResult(results) {
    if (!this.selectedResultKey) {
      return null;
    }
    const selected = results.find((result, index) => this.#buildResultKey(result, index) === this.selectedResultKey);
    if (!selected) {
      this.selectedResultKey = null;
      return null;
    }
    return selected;
  }

  #buildResultKey(result, index) {
    return `${result.top_n}::${result.tab}::${index}`;
  }

  #buildLogTable(result) {
    if (!result) {
      return "";
    }

    const rows = this.#groupLogEntries(result.log || []).map((entry) => `<tr class="${this.#actionRowClass(entry.action)}">
        <td>${this.#escapeHtml(entry.date)}</td>
        <td>${this.#escapeHtml(entry.action)}</td>
        <td class="num">${entry.qty == null ? "" : this.#formatQty(entry.qty)}</td>
        <td class="num">${entry.action === "Final snapshot" ? "" : this.#formatAmount(entry.amount)}</td>
        <td class="num">${this.#formatAmount(entry.deposited)}</td>
        <td class="num">${this.#formatAmount(entry.current)}</td>
        <td class="num">${this.#formatAmount(entry.invested)}</td>
        <td class="num">${this.#formatAmount(entry.depositCash)}</td>
        <td class="num">${this.#formatAmount(entry.saleCash)}</td>
        <td class="num">${this.#formatAmount(Number(entry.current) - Number(entry.deposited))}</td>
        <td class="num">${Number(entry.returns).toFixed(2)} %</td>
      </tr>`).join("");

    return `<section class="action-log-section">
      <h2 id="tab-log-header">Action Log · Top ${result.top_n} · ${this.#escapeHtml(result.tab)}</h2>
      <table class="secondary-log-table">
        <thead><tr>
          <th>Date</th><th>Action</th><th>Qty</th><th>Amount</th>
          <th>Deposited</th><th>Current</th><th>Invested</th>
          <th>Deposit $$</th><th>Sale $$</th><th>P/L</th><th>P/L %</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }

  #groupLogEntries(entries) {
    const grouped = [];
    const indexByKey = new Map();

    entries.forEach((entry) => {
      const buyMatch = /^Buy\s+(.+)$/.exec(entry.action || "");
      const sellMatch = /^Sell\s+(.+)$/.exec(entry.action || "");
      const ticker = (buyMatch || sellMatch)?.[1];
      if (!ticker) {
        grouped.push(entry);
        return;
      }

      const actionType = buyMatch ? "Buy" : "Sell";
      const key = `${entry.date}::${actionType}::${ticker}`;
      const index = indexByKey.get(key);
      if (index == null) {
        grouped.push({ ...entry });
        indexByKey.set(key, grouped.length - 1);
        return;
      }
      const last = grouped[index];

      last.qty = this.#sumNullableQty(last.qty, entry.qty);
      last.amount = +(Number(last.amount || 0) + Number(entry.amount || 0)).toFixed(2);
      last.deposited = entry.deposited;
      last.current = entry.current;
      last.invested = entry.invested;
      last.depositCash = entry.depositCash;
      last.saleCash = entry.saleCash;
      last.returns = entry.returns;
    });

    return grouped;
  }

  #actionRowClass(action) {
    if (action === "Deposit") {
      return "log-row-type-deposit";
    }
    if (/^Buy\s+/.test(action)) {
      return "log-row-type-buy";
    }
    if (/^Sell\s+/.test(action)) {
      return "log-row-type-sell";
    }
    if (/^Diff\s+/.test(action)) {
      return "log-row-type-diff";
    }
    if (action === "Final snapshot") {
      return "log-row-type-final";
    }
    return "log-row-type-default";
  }

  #sumNullableQty(left, right) {
    if (left == null && right == null) {
      return null;
    }
    return +(Number(left || 0) + Number(right || 0)).toFixed(6);
  }

  #bindTabLinkEvents() {
    if (typeof this.containerElement.querySelectorAll !== "function") {
      return;
    }

    const links = this.containerElement.querySelectorAll(".tab-log-link");
    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const resultKey = link.dataset.resultKey;
        if (!resultKey) {
          return;
        }
        this.selectedResultKey = resultKey;
        this.render(this.results);
        const logHeader = this.containerElement.querySelector("#tab-log-header");
        if (logHeader) {
          logHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  #formatAmount(amount) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return "";
    }
    return numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  #formatQty(qty) {
    return Number(qty).toLocaleString("en-US", { maximumFractionDigits: 6 });
  }

  #escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
