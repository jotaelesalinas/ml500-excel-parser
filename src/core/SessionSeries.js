// A chronologically sorted list of market sessions, i.e. days that actually quoted a
// value. Weekends, holidays and "#N/A" cells never make it in, so "N sessions ago"
// always means N entries back in this list.
export class SessionSeries {
  constructor(sessions = []) {
    const byDate = new Map();
    sessions.forEach((session) => {
      if (session == null || session.date == null || !Number.isFinite(session.value)) {
        return;
      }
      if (!byDate.has(session.date)) {
        byDate.set(session.date, { date: session.date, value: session.value });
      }
    });

    this.sessions = [...byDate.values()].sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));
  }

  get length() {
    return this.sessions.length;
  }

  isEmpty() {
    return this.sessions.length === 0;
  }

  lastSession() {
    return this.sessions.length === 0 ? null : this.sessions[this.sessions.length - 1];
  }

  // Index of the last session on or before the given date, or -1 when the series
  // starts later than that date.
  indexAtOrBefore(date) {
    let low = 0;
    let high = this.sessions.length - 1;
    let found = -1;

    while (low <= high) {
      const middle = (low + high) >> 1;
      if (this.sessions[middle].date <= date) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return found;
  }

  sessionAtOrBefore(date) {
    const index = this.indexAtOrBefore(date);
    return index < 0 ? null : this.sessions[index];
  }

  sessionsAfter(date) {
    return this.sessions.slice(this.indexAtOrBefore(date) + 1);
  }

  // Percentage change between the session covering `date` and the one `sessionCount`
  // sessions earlier. Returns null when there is not enough history to compare.
  changePctOverSessions(date, sessionCount) {
    const index = this.indexAtOrBefore(date);
    if (index < 0 || sessionCount <= 0 || index - sessionCount < 0) {
      return null;
    }

    const previous = this.sessions[index - sessionCount].value;
    if (!(previous > 0)) {
      return null;
    }

    return ((this.sessions[index].value / previous) - 1) * 100;
  }
}
