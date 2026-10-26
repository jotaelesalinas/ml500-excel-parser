import { SALE_BLOCK_LABEL } from "../config/constants.js";

// Parses the "Block sales S&P 500 -D" field: empty means the feature is off, a list of
// positive whole numbers means "compare the index against its value N sessions ago",
// and anything else is a user error.
export class SaleBlockLookbackParser {
  parse(rawValue) {
    const text = String(rawValue ?? "").trim();
    if (text === "") {
      return [];
    }

    return text.split(",").map((part) => this.#parseLookback(part, text));
  }

  #parseLookback(rawPart, fullText) {
    const part = rawPart.trim();
    if (!/^\d+$/.test(part) || Number(part) <= 0) {
      throw new Error(
        `Invalid "${SALE_BLOCK_LABEL}" value: "${fullText}". Use positive whole numbers separated by commas, for example "20,50,100".`,
      );
    }

    return Number(part);
  }
}
