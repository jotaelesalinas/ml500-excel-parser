const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

// Sheets hands us whatever the cell displays: "3,824.14", "#N/A", "" or a real number.
export function parseSheetNumber(rawValue) {
  if (rawValue == null) {
    return null;
  }

  const text = String(rawValue).trim().replace(/[\s,]/g, "");
  if (text === "") {
    return null;
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// Only ISO dates are accepted; anything else (a "Date" header, a locale-formatted
// cell) is reported as unusable so the caller can skip the row instead of guessing
// whether "3/1/2023" means January 3rd or March 1st.
export function parseSheetDate(rawValue) {
  if (rawValue == null) {
    return null;
  }

  const match = ISO_DATE_PREFIX.exec(String(rawValue).trim());
  return match ? match[1] : null;
}

// Header cells are compared case- and accent-insensitively, so "Día", "DIA" and "dia"
// all name the same column.
export function normalizeSheetHeader(rawHeader) {
  return String(rawHeader ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
