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
    };
  }
}
