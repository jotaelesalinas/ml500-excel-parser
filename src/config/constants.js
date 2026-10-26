export const FIELDS = [
  "Ticker",
  "Nombre",
  "FechaC",
  "Cantidad",
  "PrecioC",
  "FechaV",
  "PrecioV",
  "PrecioA",
];

export const FIELD_SLUGS = FIELDS.map((field) => field.toLowerCase());
export const REQUIRED_FIELD_SLUGS = ["ticker", "nombre", "fechac", "cantidad", "precioc"];
export const MIN_DEPOSIT = 1000;
export const MIN_INVESTMENT = 100;

export const INDEX_HISTORY_TAB = "Index hist";
export const PRICE_HISTORY_TAB = "Prices hist";
export const SALE_BLOCK_LABEL = "Block sales S&P 500 -D";
export const SALE_BLOCK_LOOKBACKS = "20,50,100";

export function defaultTodayProvider() {
  return new Date().toISOString().slice(0, 10);
}
