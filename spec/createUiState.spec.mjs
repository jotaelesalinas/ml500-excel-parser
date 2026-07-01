import { createUiState } from "../src/ui/state/createUiState.js";

describe("createUiState", () => {
  it("creates the default state", () => {
    const store = createUiState();

    expect(store.getState()).toEqual({
      inputMode: "fields",
      visibleStrategies: null,
      sortState: {
        field: null,
        direction: "asc",
        hasSorted: false,
      },
      selectedResultKey: null,
      results: [],
      isProcessing: false,
      loadButtonLabel: "Load data",
    });
  });

  it("notifies subscribers with snapshots when state changes", () => {
    const store = createUiState();
    const listener = jasmine.createSpy("listener");

    store.subscribe(listener);
    store.setInputMode("paste");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.calls.mostRecent().args[0].inputMode).toBe("paste");
    expect(listener.calls.mostRecent().args[1].inputMode).toBe("fields");
  });

  it("toggles sorting on the same field and resets it when cleared", () => {
    const store = createUiState();

    store.setSort("returns");
    expect(store.getState().sortState).toEqual({
      field: "returns",
      direction: "asc",
      hasSorted: true,
    });

    store.setSort("returns");
    expect(store.getState().sortState).toEqual({
      field: "returns",
      direction: "desc",
      hasSorted: true,
    });

    store.setSort(null);
    expect(store.getState().sortState).toEqual({
      field: null,
      direction: "asc",
      hasSorted: false,
    });
  });

  it("updates visible strategies and clears selection explicitly", () => {
    const store = createUiState();

    store.setVisibleStrategies(new Set(["Fixed D", "Full S"]));
    expect(Array.from(store.getState().visibleStrategies)).toEqual(["Fixed D", "Full S"]);

    store.setSelectedResultKey("1::Tab A::1");
    store.clearResultsSelection();
    expect(store.getState().selectedResultKey).toBeNull();

    store.setVisibleStrategies(null);
    expect(store.getState().visibleStrategies).toBeNull();
  });

  it("tracks processing and button label state", () => {
    const store = createUiState();

    store.setProcessing(true);
    store.setLoadButtonLabel("Loading data...");

    expect(store.getState().isProcessing).toBeTrue();
    expect(store.getState().loadButtonLabel).toBe("Loading data...");
  });
});
