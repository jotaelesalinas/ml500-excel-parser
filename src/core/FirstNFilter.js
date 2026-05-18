export class FirstNFilter {
  filter(entries, firstN) {
    const countsByDate = {};

    return entries.filter((entry) => {
      countsByDate[entry.fechac] ??= 0;
      countsByDate[entry.fechac] += 1;
      return countsByDate[entry.fechac] <= firstN;
    });
  }
}
