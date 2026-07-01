import { escapeHtml, formatAmount, formatPercentage } from "./formatters.js";

const COLUMNS = [
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

const GROUPS = [
  { colspan: 3, label: "", cls: "group-spacer" },
  { colspan: 2, label: "Portfolio", cls: "group-header" },
  { colspan: 3, label: "Current breakdown", cls: "group-header group-header-accent" },
  { colspan: 4, label: "Performance", cls: "group-header" },
];

function buildHeaderCells(sortState) {
  return COLUMNS.map((column, index) => {
    const isActiveSort = Boolean(sortState?.hasSorted && sortState.field === column.field);
    const classes = ["result-sort-header"];
    if (column.numeric) {
      classes.push("num");
    }
    if (isActiveSort) {
      classes.push(`is-sorted-${sortState.direction}`);
    }

    const isFirstOfGroup = index === 0 || COLUMNS[index - 1].group !== column.group;
    if (isFirstOfGroup && column.group !== "id") {
      classes.push("col-border-left");
    }

    const ariaSortValue = isActiveSort
      ? sortState.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";

    const dotHtml = column.dot ? `<span class="col-dot col-dot-${column.dot}"></span>` : "";
    return `<th class="${classes.join(" ")}" data-sort-field="${column.field}" tabindex="0" role="button" aria-sort="${ariaSortValue}">${dotHtml}${column.label}</th>`;
  }).join("");
}

function buildGroupHeaderRow() {
  return GROUPS.map((group) => `<th colspan="${group.colspan}" class="${group.cls}">${group.label}</th>`).join("");
}

function buildRow(result, resultKey) {
  const pl = Number(result.current) - Number(result.deposited);
  const plClass = pl >= 0 ? "val-positive" : "val-negative";
  const cur = Number(result.current);
  const inv = Number(result.invested) || 0;
  const depC = Number(result.depositCash) || 0;
  const salC = Number(result.saleCash) || 0;
  const total = inv + depC + salC || 1;
  const pctInv = ((inv / total) * 100).toFixed(1);
  const pctDep = ((depC / total) * 100).toFixed(1);
  const pctSal = ((salC / total) * 100).toFixed(1);
  const xirr = result.XIRR;

  return `<tr>
        <td class="num mono">${result.top_n}</td>
        <td><a href="#" class="tab-log-link" data-result-key="${escapeHtml(resultKey)}">${escapeHtml(result.tab)}</a></td>
        <td class="mono" style="font-size:0.6875rem;">${escapeHtml(result.strat || "")}</td>
        <td class="num mono col-border-left val-muted">${formatAmount(result.deposited)}</td>
        <td class="num mono val-heading">
          ${formatAmount(cur)}
          <div class="comp-bar">
            <div class="comp-bar-inv" style="width:${pctInv}%"></div>
            <div class="comp-bar-dep" style="width:${pctDep}%"></div>
            <div class="comp-bar-sale" style="width:${pctSal}%"></div>
          </div>
        </td>
        <td class="num mono col-border-left">${formatAmount(result.invested)}</td>
        <td class="num mono val-muted">${formatAmount(result.depositCash)}</td>
        <td class="num mono val-muted">${formatAmount(result.saleCash)}</td>
        <td class="num mono col-border-left ${plClass}" style="font-weight:600;">${formatAmount(pl)}</td>
        <td class="num mono ${plClass}">${formatPercentage(result.returns, { space: true })}</td>
        <td class="num mono val-muted">${result.avg_age_y}</td>
        <td class="num mono ${plClass}">${xirr === "N/A" ? "N/A" : formatPercentage(xirr, { space: true })}</td>
    </tr>`;
}

export function buildResultsTableMarkup(results, sortState, resultKeyRegistry) {
  const sortedClass = sortState?.hasSorted ? " is-user-sorted" : "";
  const groupHeaderRow = buildGroupHeaderRow();
  const headerCells = buildHeaderCells(sortState);
  const rows = results.map((result) => buildRow(result, resultKeyRegistry.getKey(result))).join("");

  return `<table class="results-table${sortedClass}">
      <thead><tr>${groupHeaderRow}</tr><tr>${headerCells}</tr></thead><tbody>${rows}</tbody>
    </table>`;
}
