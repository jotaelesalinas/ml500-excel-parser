export class BulkFormInputParser {
  parse(text) {
    const lines = String(text)
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      spreadsheetUrl: lines[0] || "",
      apiKey: lines[1] || "",
      firstN: lines[2] || "",
      minDeposit: lines[3] || "",
      minInvestment: lines[4] || "",
      reinvest: this.#parseBoolean(lines[5]),
    };
  }

  #parseBoolean(rawValue) {
    if (!rawValue) {
      return null;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "off"].includes(normalized)) {
      return false;
    }
    return null;
  }
}
