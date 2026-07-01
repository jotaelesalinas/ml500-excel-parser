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
      { field: "top_n", label: "Top N", numeric: true, group: "id" },
      { field: "tab", label: "Tab", numeric: false, group: "id" },
      { field: "strat", label: "Strategy", numeric: false, group: "id" },
      { field: "deposited", label: "Deposited", numeric: true, group: "portfolio" },
      { field: "current", label: "Current", numeric: true, group: "portfolio" },
      { field: "invested", label: "Invested", numeric: true, group: "breakdown", dot: "invested" },
      { field: "depositCash", label: "Deposits", numeric: true, group: "breakdown", dot: "deposits" },
      { field: "saleCash", label: "Sales", numeric: true, group: "breakdown", dot: "sales" },
      { field: "pl", label: "P/L", numeric: true, group: "performance" },
      { field: "returns", label: "P/L %", numeric: true, group: "performance" },
      { field: "avg_age_y", label: "Age", numeric: true, group: "performance" },
      { field: "XIRR", label: "XIRR", numeric: true, group: "performance" },
    ];

    // --- Summary boxes (Min · Avg · Max) ---
    let summaryHtml = this.#buildSummaryBoxes(sortedResults);

    // --- Group header row ---
    const groups = [
      { key: "id", colspan: 3, label: "", cls: "group-spacer" },
      { key: "portfolio", colspan: 2, label: "Portfolio", cls: "group-header" },
      { key: "breakdown", colspan: 3, label: "Current breakdown", cls: "group-header group-header-accent" },
      { key: "performance", colspan: 4, label: "Performance", cls: "group-header" },
    ];
    const groupHeaderRow = groups.map((g) =>
      `<th colspan="${g.colspan}" class="${g.cls}">${g.label}</th>`
    ).join("");

    // --- Column header row ---
    const headerCells = columns.map((column, i) => {
      const isActiveSort = this.sortState.hasSorted && this.sortState.field === column.field;
      const classes = ["result-sort-header"];
      if (column.numeric) classes.push("num");
      if (isActiveSort) classes.push(`is-sorted-${this.sortState.direction}`);
      // Add left-border for first column of each group (except id)
      const isFirstOfGroup = i === 0 || columns[i - 1].group !== column.group;
      if (isFirstOfGroup && column.group !== "id") classes.push("col-border-left");

      const ariaSortValue = isActiveSort
        ? (this.sortState.direction === "asc" ? "ascending" : "descending")
        : "none";

      let dotHtml = "";
      if (column.dot) {
        dotHtml = `<span class="col-dot col-dot-${column.dot}"></span>`;
      }

      return `<th class="${classes.join(" ")}" data-sort-field="${column.field}" tabindex="0" role="button" aria-sort="${ariaSortValue}">${dotHtml}${column.label}</th>`;
    }).join("");

    let html = summaryHtml;
    html += `<table class="results-table${this.sortState.hasSorted ? " is-user-sorted" : ""}">
        <thead><tr>${groupHeaderRow}</tr><tr>${headerCells}</tr></thead><tbody>`;

    sortedResults.forEach((result) => {
      const rowKey = this.#buildResultKey(result);
      const pl = Number(result.current) - Number(result.deposited);
      const plPct = Number(result.returns);
      const xirr = result.XIRR;
      const plClass = pl >= 0 ? "val-positive" : "val-negative";

      // Composition bar percentages
      const cur = Number(result.current);
      const inv = Number(result.invested) || 0;
      const depC = Number(result.depositCash) || 0;
      const salC = Number(result.saleCash) || 0;
      const total = inv + depC + salC || 1;
      const pctInv = ((inv / total) * 100).toFixed(1);
      const pctDep = ((depC / total) * 100).toFixed(1);
      const pctSal = ((salC / total) * 100).toFixed(1);

      html += `<tr>
            <td class="num mono">${result.top_n}</td>
            <td><a href="#" class="tab-log-link" data-result-key="${this.#escapeHtml(rowKey)}">${this.#escapeHtml(result.tab)}</a></td>
            <td class="mono" style="font-size:0.6875rem;">${this.#escapeHtml(result.strat || "")}</td>
            <td class="num mono col-border-left val-muted">${result.deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num mono val-heading">
              ${result.current.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              <div class="comp-bar">
                <div class="comp-bar-inv" style="width:${pctInv}%"></div>
                <div class="comp-bar-dep" style="width:${pctDep}%"></div>
                <div class="comp-bar-sale" style="width:${pctSal}%"></div>
              </div>
            </td>
            <td class="num mono col-border-left">${result.invested.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="num mono val-muted">${this.#formatAmount(result.depositCash)}</td>
            <td class="num mono val-muted">${this.#formatAmount(result.saleCash)}</td>
            <td class="num mono col-border-left ${plClass}" style="font-weight:600;">${this.#formatAmount(pl)}</td>
            <td class="num mono ${plClass}">${plPct.toFixed(2)} %</td>
            <td class="num mono val-muted">${result.avg_age_y}</td>
            <td class="num mono ${plClass}">${xirr === "N/A" ? "N/A" : `${Number(xirr).toFixed(2)} %`}</td>
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

  // --- Summary boxes ---
  #buildSummaryBoxes(results) {
    if (results.length === 0) return "";

    const metrics = [
      { name: "P/L %", get: (r) => Number(r.returns), pct: true },
      { name: "Age", get: (r) => Number(r.avg_age_y), pct: false, dec: 1 },
      { name: "XIRR", get: (r) => { const v = Number(r.XIRR); return Number.isFinite(v) ? v : null; }, pct: true },
    ];

    const idOf = (r) => `${this.#escapeHtml(r.tab)} · ${this.#escapeHtml(r.strat || "")} · Top ${r.top_n}`;

    const boxes = metrics.map((m) => {
      const vals = results.map(m.get).filter((v) => v != null && Number.isFinite(v));
      if (vals.length === 0) return "";
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
      const maxRow = results.find((r) => m.get(r) === max);
      const fmt = (n) => {
        if (m.pct) return (n >= 0 ? "+" : "\u2212") + Math.abs(n).toFixed(2) + "%";
        return n.toFixed(m.dec ?? 2);
      };
      return `<div class="summary-box">
        <div class="summary-box-label">Min · Avg · Max ${m.name}</div>
        <div class="summary-box-values">${fmt(min)} · ${fmt(avg)} · ${fmt(max)}</div>
        <div class="summary-box-id">Max: ${maxRow ? idOf(maxRow) : "—"}</div>
      </div>`;
    }).join("");

    return `<div class="summary-boxes">${boxes}</div>`;
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
          <th>Deposits</th><th>Sales</th><th>P/L</th><th>P/L %</th>
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
