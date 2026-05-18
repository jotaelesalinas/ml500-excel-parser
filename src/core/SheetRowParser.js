export class SheetRowParser {
  constructor(fieldSlugs) {
    this.fieldSlugs = fieldSlugs;
  }

  parse(rows) {
    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map((header) => String(header).trim().toLowerCase());

    return rows
      .slice(1)
      .map((row) => this.#buildEntry(row, headers))
      .filter((entry) => entry.ticker !== "");
  }

  #buildEntry(row, headers) {
    const entry = {};

    this.fieldSlugs.forEach((slug) => {
      const columnIndex = headers.indexOf(slug);
      entry[slug] = columnIndex >= 0 && row[columnIndex] != null ? String(row[columnIndex]).trim() : "";
    });

    return entry;
  }
}
