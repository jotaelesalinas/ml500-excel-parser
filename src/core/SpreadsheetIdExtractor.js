export class SpreadsheetIdExtractor {
  extract(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error("Could not extract spreadsheet ID from URL.");
    }
    return match[1];
  }
}
