const MAX_PER_KIND = 5;

// Collects the problems found while reading a history tab. Problems of the same kind are
// capped and then counted, so a whole column pasted in the wrong format is reported in a
// handful of lines instead of one per row.
export class SheetIssueLog {
  constructor(tabName, { maxPerKind = MAX_PER_KIND } = {}) {
    this.tabName = tabName;
    this.maxPerKind = maxPerKind;
    this.messages = [];
    this.countsByKind = new Map();
  }

  add(message) {
    this.messages.push(`"${this.tabName}": ${message}`);
    return this;
  }

  // `kind` names what is being counted ("row(s) with an unusable date"), so the summary
  // line can read "and 12 more row(s) with an unusable date".
  addCapped(kind, message) {
    const alreadyAdded = this.countsByKind.get(kind) || 0;
    this.countsByKind.set(kind, alreadyAdded + 1);
    if (alreadyAdded < this.maxPerKind) {
      this.add(message);
    }
    return this;
  }

  list() {
    const summaries = [...this.countsByKind.entries()]
      .filter(([, count]) => count > this.maxPerKind)
      .map(([kind, count]) => `"${this.tabName}": and ${count - this.maxPerKind} more ${kind}.`);

    return [...this.messages, ...summaries];
  }
}
