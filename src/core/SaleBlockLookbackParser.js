import { SALE_BLOCK_LABEL } from "../config/constants.js";

// Parses the "Block sales S&P 500 -D" field: a list of positive whole numbers means
// "compare the index against its value N sessions ago", and anything else is a user
// error. An empty field turns the feature off, unless the block is switched on, where
// it is an error: a block with no lookback would never block anything.
export class SaleBlockLookbackParser {
  parse(rawValue, { required = false } = {}) {
    const text = String(rawValue ?? "").trim();
    if (text === "") {
      if (required) {
        throw new Error(
          `"${SALE_BLOCK_LABEL}" is on, so it needs at least one number of sessions. Use positive whole numbers separated by commas, for example "20,50,100".`,
        );
      }

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
