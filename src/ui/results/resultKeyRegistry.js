export function createResultKeyRegistry() {
  const resultIds = new WeakMap();
  let nextResultId = 0;

  return {
    getKey(result) {
      if (result == null || typeof result !== "object") {
        return String(result);
      }

      let keyId = resultIds.get(result);
      if (!keyId) {
        nextResultId += 1;
        keyId = nextResultId;
        resultIds.set(result, keyId);
      }

      return `${result.top_n}::${result.tab}::${keyId}`;
    },
  };
}
