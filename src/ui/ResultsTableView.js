export class ResultsTableView {
  constructor(containerElement) {
    this.containerElement = containerElement;
    this.results = [];
    this.allResults = [];
    this.visibleStrategies = null;
    this.selectedResultKey = null;
    this.sortState = {
      field: null,
      direction: "asc",
      hasSorted: false,
    };
    this.resultIds = new WeakMap();
    this.nextResultId = 0;
  }

  setStrategyFilter(strategySet) {
    this.visibleStrategies = strategySet;
    if (this.allResults.length > 0) {
      this.render(this.allResults);
    }
  }

  render(results) {
    this.allResults = results;
    const filteredResults = this.visibleStrategies
      ? results.filter((r) => this.visibleStrategies.has(r.strat))
      : results;

    if (filteredResults.length === 0) {
      this.results = [];
      this.containerElement.innerHTML = results.length === 0
        ? "<p>No results.</p>"
        : "<p>No results for the selected strategies.</p>";
      if (results.length === 0) {
        this.selectedResultKey = null;
      }
      return;
    }

    const sortedResults = this.#sortResults(filteredResults);
    this.results = sortedResults;
    const selectedResult = this.#getSelectedResult(sortedResults);
    const columns = [
      { field: "top_n", label: "Top N", numeric: true },
      { field: "tab", label: "Tab", numeric: false },
      { field: "strat", label: "Strat", numeric: false },
      { field: "deposited", label: "Deposited", numeric: true },
      { field: "current", label: "Current", numeric: true },
      { field: "invested", label: "Invested", numeric: true },
      { field: "depositCash", label: "Deposit $$", numeric: true },
      { field: "saleCash", label: "Sale $$", numeric: true },
      { field: "pl", label: "P/L", numeric: true },
      { field: "returns", label: "P/L %", numeric: true },
      { field: "avg_age_y", label: "Age (Y)", numeric: true },
      { field: "XIRR", label: "XIRR", numeric: true },
    ];

    const headerCells = columns.map((column) => {
      const isActiveSort = this.sortState.hasSorted && this.sortState.field === column.field;
      const classes = ["result-sort-header"];
      if (column.numeric) {
        classes.push("num");
      }
      if (isActiveSort) {
        classes.push(`is-sorted-${this.sortState.direction}`);
      }
      const ariaSortValue = isActiveSort
        ? (this.sortState.direction === "asc" ? "ascending" : "descending")
        : "none";
      return `<th class="${classes.join(" ")}" data-sort-field="${column.field}" tabindex="0" role="button" aria-sort="${ariaSortValue}">${column.label}</th>`;
    }).join("");

    let html = `<table class="results-table${this.sortState.hasSorted ? " is-user-sorted" : ""}">
        <thead><tr>${headerCells}</tr></thead><tbody>`;

    sortedResults.forEach((result) => {
      const rowKey = this.#buildResultKey(result);
      const pl = Number(result.current) - Number(result.deposited);
      html += `<tr>
            <td class="num">${result.top_n}</td>
            <td><a href="#" class="tab-log-link" data-result-key="${this.#escapeHtml(rowKey)}">${this.#escapeHtml(result.tab)}</a></td>
            <td>${this.#escapeHtml(result.strat || "")}</td>
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
    this.#bindSortHeaderEvents();
    this.#bindTabLinkEvents();
  }

  clearSelection() {
    this.selectedResultKey = null;
  }

  #getSelectedResult(results) {
    if (!this.selectedResultKey) {
      return null;
    }

    const selected = results.find((result) => this.#buildResultKey(result) === this.selectedResultKey);
    if (selected) {
      return selected;
    }

    const legacySelected = this.#findSelectedResultByLegacyKey(results, this.selectedResultKey);
    if (legacySelected) {
      this.selectedResultKey = this.#buildResultKey(legacySelected);
      return legacySelected;
    }

    this.selectedResultKey = null;
    return null;
  }

  #findSelectedResultByLegacyKey(results, selectedResultKey) {
    const keyParts = selectedResultKey.split("::");
    if (keyParts.length < 3) {
      return null;
    }
    const indexPart = keyParts[keyParts.length - 1];
    const index = Number(indexPart);
    if (!Number.isInteger(index) || index < 0 || index >= results.length) {
      return null;
    }
    const expectedTopN = keyParts[0];
    const expectedTab = keyParts.slice(1, -1).join("::");
    const result = results[index];
    if (String(result.top_n) !== expectedTopN || String(result.tab) !== expectedTab) {
      return null;
    }
    return result;
  }

  #buildResultKey(result) {
    if (result == null || typeof result !== "object") {
      return String(result);
    }

    let id = this.resultIds.get(result);
    if (!id) {
      this.nextResultId += 1;
      id = this.nextResultId;
      this.resultIds.set(result, id);
    }
    return `${result.top_n}::${result.tab}::${id}`;
  }

  #sortResults(results) {
    const indexedResults = results.map((result, index) => ({ result, index }));
    if (!this.sortState.hasSorted || !this.sortState.field) {
      return indexedResults.map((entry) => entry.result);
    }

    const directionFactor = this.sortState.direction === "asc" ? 1 : -1;
    indexedResults.sort((leftEntry, rightEntry) => {
      const comparison = this.#compareResultsByField(leftEntry.result, rightEntry.result, this.sortState.field);
      if (comparison !== 0) {
        return comparison * directionFactor;
      }
      return leftEntry.index - rightEntry.index;
    });

    return indexedResults.map((entry) => entry.result);
  }

  #compareResultsByField(leftResult, rightResult, field) {
    if (field === "tab" || field === "strat") {
      return String(leftResult[field] || "").localeCompare(String(rightResult[field] || ""));
    }

    const leftValue = this.#getSortableNumericValue(leftResult, field);
    const rightValue = this.#getSortableNumericValue(rightResult, field);
    const leftIsFinite = Number.isFinite(leftValue);
    const rightIsFinite = Number.isFinite(rightValue);

    if (!leftIsFinite && !rightIsFinite) {
      return 0;
    }
    if (!leftIsFinite) {
      return 1;
    }
    if (!rightIsFinite) {
      return -1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
    return 0;
  }

  #getSortableNumericValue(result, field) {
    if (field === "pl") {
      return Number(result.current) - Number(result.deposited);
    }
    return Number(result[field]);
  }

  #bindSortHeaderEvents() {
    if (typeof this.containerElement.querySelectorAll !== "function") {
      return;
    }

    const headers = this.containerElement.querySelectorAll("th[data-sort-field]");
    headers.forEach((header) => {
      const sortField = header.dataset.sortField;
      if (!sortField) {
        return;
      }

      header.addEventListener("click", () => this.#handleSortByField(sortField));
      header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.#handleSortByField(sortField);
      });
    });
  }

  #handleSortByField(sortField) {
    if (this.sortState.field === sortField) {
      this.sortState.direction = this.sortState.direction === "asc" ? "desc" : "asc";
    } else {
      this.sortState.field = sortField;
      this.sortState.direction = "asc";
    }
    this.sortState.hasSorted = true;
    this.render(this.allResults);
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
      <h2 id="tab-log-header">Action Log · Top ${result.top_n} · ${this.#escapeHtml(result.tab)} · ${this.#escapeHtml(result.strat || "")}</h2>
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
