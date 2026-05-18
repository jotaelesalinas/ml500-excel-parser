export class SheetHeaderValidator {
  constructor(requiredFieldSlugs) {
    this.requiredFieldSlugs = requiredFieldSlugs;
  }

  hasProcessableHeaders(rows) {
    if (rows.length === 0 || rows[0].length === 0) {
      return false;
    }

    const headerSet = new Set(rows[0].map((header) => String(header).trim().toLowerCase()));
    return this.requiredFieldSlugs.every((slug) => headerSet.has(slug));
  }
}
