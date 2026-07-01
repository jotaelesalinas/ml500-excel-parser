export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatAmount(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return "";
  }
  return numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function formatNumber(value, fractionDigits = 2) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }
  return numericValue.toFixed(fractionDigits);
}

export function formatQty(qty) {
  const numericQty = Number(qty);
  if (!Number.isFinite(numericQty)) {
    return "";
  }
  return numericQty.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function formatPercentage(value, { signed = false, precision = 2, space = true } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "";
  }

  const prefix = signed ? (numericValue >= 0 ? "+" : "−") : "";
  const suffix = space ? " %" : "%";
  return `${prefix}${Math.abs(numericValue).toFixed(precision)}${suffix}`;
}
