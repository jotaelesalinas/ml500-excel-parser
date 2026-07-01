function sumNullableQty(left, right) {
  if (left == null && right == null) {
    return null;
  }
  return +(Number(left || 0) + Number(right || 0)).toFixed(6);
}

export function groupLogEntries(entries) {
  const grouped = [];
  const indexByKey = new Map();

  entries.forEach((entry) => {
    const buyMatch = /^Buy\s+(.+)$/.exec(entry.action || "");
    const sellMatch = /^Sell\s+(.+)$/.exec(entry.action || "");
    const ticker = (buyMatch || sellMatch)?.[1];
    if (!ticker) {
      grouped.push(entry);
      return;
    }

    const actionType = buyMatch ? "Buy" : "Sell";
    const key = `${entry.date}::${actionType}::${ticker}`;
    const index = indexByKey.get(key);
    if (index == null) {
      grouped.push({ ...entry });
      indexByKey.set(key, grouped.length - 1);
      return;
    }

    const last = grouped[index];
    last.qty = sumNullableQty(last.qty, entry.qty);
    last.amount = +(Number(last.amount || 0) + Number(entry.amount || 0)).toFixed(2);
    last.deposited = entry.deposited;
    last.current = entry.current;
    last.invested = entry.invested;
    last.depositCash = entry.depositCash;
    last.saleCash = entry.saleCash;
    last.returns = entry.returns;
  });

  return grouped;
}
