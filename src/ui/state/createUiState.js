const DEFAULT_SORT_STATE = Object.freeze({
  field: null,
  direction: "asc",
  hasSorted: false,
});

function cloneSortState(sortState) {
  return {
    field: sortState?.field ?? null,
    direction: sortState?.direction === "desc" ? "desc" : "asc",
    hasSorted: Boolean(sortState?.hasSorted),
  };
}

function cloneVisibleStrategies(visibleStrategies) {
  return visibleStrategies == null ? null : new Set(visibleStrategies);
}

function snapshotState(state, cloneCollections = true) {
  return {
    inputMode: state.inputMode,
    visibleStrategies: cloneCollections ? cloneVisibleStrategies(state.visibleStrategies) : state.visibleStrategies,
    sortState: cloneCollections ? cloneSortState(state.sortState) : state.sortState,
    selectedResultKey: state.selectedResultKey,
    results: cloneCollections ? state.results.slice() : state.results,
    isProcessing: state.isProcessing,
    loadButtonLabel: state.loadButtonLabel,
  };
}

function areSetsEqual(left, right) {
  if (left === right) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

export function createUiState(initialState = {}) {
  const state = {
    inputMode: initialState.inputMode === "paste" ? "paste" : "fields",
    visibleStrategies: cloneVisibleStrategies(initialState.visibleStrategies ?? null),
    sortState: cloneSortState(initialState.sortState ?? DEFAULT_SORT_STATE),
    selectedResultKey: initialState.selectedResultKey ?? null,
    results: Array.isArray(initialState.results) ? initialState.results.slice() : [],
    isProcessing: Boolean(initialState.isProcessing),
    loadButtonLabel: initialState.loadButtonLabel || "Load data",
  };

  const listeners = new Set();

  function notify(previousState) {
    const nextState = snapshotState(state, false);
    for (const listener of listeners) {
      listener(nextState, previousState);
    }
  }

  function update(mutator) {
    const previousState = snapshotState(state, false);
    const changed = mutator();
    if (!changed) {
      return;
    }
    notify(previousState);
  }

  return {
    getState() {
      return snapshotState(state);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setInputMode(mode) {
      update(() => {
        const nextMode = mode === "paste" ? "paste" : "fields";
        if (state.inputMode === nextMode) {
          return false;
        }
        state.inputMode = nextMode;
        return true;
      });
    },

    setVisibleStrategies(strategySetOrNull) {
      update(() => {
        const nextVisibleStrategies =
          strategySetOrNull == null ? null : new Set(strategySetOrNull);
        if (areSetsEqual(state.visibleStrategies, nextVisibleStrategies)) {
          return false;
        }
        state.visibleStrategies = nextVisibleStrategies;
        return true;
      });
    },

    setSort(field) {
      update(() => {
        if (!field) {
          const resetSortState = cloneSortState(DEFAULT_SORT_STATE);
          const isAlreadyReset =
            state.sortState.field == null &&
            state.sortState.direction === resetSortState.direction &&
            state.sortState.hasSorted === resetSortState.hasSorted;
          if (isAlreadyReset) {
            return false;
          }
          state.sortState = resetSortState;
          return true;
        }

        const isSameField = state.sortState.field === field;
        const nextDirection =
          isSameField && state.sortState.hasSorted && state.sortState.direction === "asc"
            ? "desc"
            : "asc";
        const nextSortState = {
          field,
          direction: nextDirection,
          hasSorted: true,
        };

        if (
          state.sortState.field === nextSortState.field &&
          state.sortState.direction === nextSortState.direction &&
          state.sortState.hasSorted === nextSortState.hasSorted
        ) {
          return false;
        }

        state.sortState = nextSortState;
        return true;
      });
    },

    setSelectedResultKey(keyOrNull) {
      update(() => {
        const nextKey = keyOrNull ?? null;
        if (state.selectedResultKey === nextKey) {
          return false;
        }
        state.selectedResultKey = nextKey;
        return true;
      });
    },

    setResults(resultsArray) {
      update(() => {
        const nextResults = Array.isArray(resultsArray) ? resultsArray.slice() : [];
        if (state.results === nextResults) {
          return false;
        }
        state.results = nextResults;
        return true;
      });
    },

    clearResultsSelection() {
      this.setSelectedResultKey(null);
    },

    setProcessing(isProcessing) {
      update(() => {
        const nextValue = Boolean(isProcessing);
        if (state.isProcessing === nextValue) {
          return false;
        }
        state.isProcessing = nextValue;
        return true;
      });
    },

    setLoadButtonLabel(label) {
      update(() => {
        const nextLabel = String(label);
        if (state.loadButtonLabel === nextLabel) {
          return false;
        }
        state.loadButtonLabel = nextLabel;
        return true;
      });
    },
  };
}
