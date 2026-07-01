import { escapeHtml, formatPercentage, formatNumber } from "./formatters.js";

export function buildSummaryMarkup(results) {
  if (!results.length) {
    return "";
  }

  const metrics = [
    { name: "P/L %", get: (result) => Number(result.returns), pct: true },
    { name: "Age", get: (result) => Number(result.avg_age_y), pct: false, decimals: 1 },
    {
      name: "XIRR",
      get: (result) => {
        const value = Number(result.XIRR);
        return Number.isFinite(value) ? value : null;
      },
      pct: true,
    },
  ];

  const idOf = (result) =>
    `${escapeHtml(result.tab)} · ${escapeHtml(result.strat || "")} · Top ${result.top_n}`;

  const boxes = metrics
    .map((metric) => {
      const values = results.map(metric.get).filter((value) => value != null && Number.isFinite(value));
      if (!values.length) {
        return "";
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      const maxRow = results.find((result) => metric.get(result) === max);
      const formatValue = (value) => {
        if (metric.pct) {
          return formatPercentage(value, { signed: true });
        }
        return formatNumber(value, metric.decimals ?? 2);
      };

      return `<div class="summary-box">
        <div class="summary-box-label">Min · Avg · Max ${metric.name}</div>
        <div class="summary-box-values">${formatValue(min)} · ${formatValue(avg)} · ${formatValue(max)}</div>
        <div class="summary-box-id">Max: ${maxRow ? idOf(maxRow) : "—"}</div>
      </div>`;
    })
    .join("");

  return `<div class="summary-boxes">${boxes}</div>`;
}
