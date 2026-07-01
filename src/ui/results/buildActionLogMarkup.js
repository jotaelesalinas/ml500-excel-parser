import { escapeHtml, formatAmount, formatQty, formatPercentage } from "./formatters.js";
import { groupLogEntries } from "./groupLogEntries.js";

function actionRowClass(action) {
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

export function buildActionLogMarkup(result) {
  if (!result) {
    return "";
  }

  const rows = groupLogEntries(result.log || [])
    .map(
      (entry) => `<tr class="${actionRowClass(entry.action)}">
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(entry.action)}</td>
        <td class="num">${entry.qty == null ? "" : formatQty(entry.qty)}</td>
        <td class="num">${entry.action === "Final snapshot" ? "" : formatAmount(entry.amount)}</td>
        <td class="num">${formatAmount(entry.deposited)}</td>
        <td class="num">${formatAmount(entry.current)}</td>
        <td class="num">${formatAmount(entry.invested)}</td>
        <td class="num">${formatAmount(entry.depositCash)}</td>
        <td class="num">${formatAmount(entry.saleCash)}</td>
        <td class="num">${formatAmount(Number(entry.current) - Number(entry.deposited))}</td>
        <td class="num">${formatPercentage(entry.returns, { space: true })}</td>
      </tr>`,
    )
    .join("");

  return `<section class="action-log-section">
      <h2 id="tab-log-header">Action Log · Top ${result.top_n} · ${escapeHtml(result.tab)} · ${escapeHtml(result.strat || "")}</h2>
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
