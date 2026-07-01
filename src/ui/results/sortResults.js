function compareResultsByField(leftResult, rightResult, field) {
  if (field === "tab" || field === "strat") {
    return String(leftResult[field] || "").localeCompare(String(rightResult[field] || ""));
  }

  const leftValue = getSortableNumericValue(leftResult, field);
  const rightValue = getSortableNumericValue(rightResult, field);
  const leftIsFinite = Number.isFinite(leftValue);
  const rightIsFinite = Number.isFinite(rightValue);

  if (!leftIsFinite && !rightIsFinite) {
    return 0;
  }
  if (!leftIsFinite) {
    return 1;
  }
  if (!rightIsFinite) {
    return -1;
  }
  if (leftValue < rightValue) {
    return -1;
  }
  if (leftValue > rightValue) {
    return 1;
  }
  return 0;
}

function getSortableNumericValue(result, field) {
  if (field === "pl") {
    return Number(result.current) - Number(result.deposited);
  }
  return Number(result[field]);
}

export function sortResults(results, sortState) {
  const indexedResults = results.map((result, index) => ({ result, index }));
  if (!sortState?.hasSorted || !sortState.field) {
    return indexedResults.map((entry) => entry.result);
  }

  const directionFactor = sortState.direction === "desc" ? -1 : 1;
  indexedResults.sort((leftEntry, rightEntry) => {
    const comparison = compareResultsByField(leftEntry.result, rightEntry.result, sortState.field);
    if (comparison !== 0) {
      return comparison * directionFactor;
    }
    return leftEntry.index - rightEntry.index;
  });

  return indexedResults.map((entry) => entry.result);
}
