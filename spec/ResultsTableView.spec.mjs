import { ResultsTableView } from "../src/ui/ResultsTableView.js";
import { createUiState } from "../src/ui/state/createUiState.js";
import { createResultKeyRegistry } from "../src/ui/results/resultKeyRegistry.js";

function createContainer() {
  const listenersBySelector = new Map();
  return {
    innerHTML: "",
    querySelectorAll(selector) {
      return listenersBySelector.get(selector) || [];
    },
    querySelector(selector) {
      if (selector === "#tab-log-header" && this.innerHTML.includes("tab-log-header")) {
        return {
          scrollIntoView: jasmine.createSpy("scrollIntoView"),
        };
      }
      return null;
    },
    setQueryResults(selector, elements) {
      listenersBySelector.set(selector, elements);
    },
  };
}

function createHeaderElement(field) {
  const listeners = new Map();
  return {
    dataset: { sortField: field },
    addEventListener: jasmine.createSpy("addEventListener").and.callFake((eventName, handler) => {
      listeners.set(eventName, handler);
    }),
    trigger(eventName, event = {}) {
      const handler = listeners.get(eventName);
      if (handler) {
        handler(event);
      }
    },
  };
}

function createLinkElement(resultKey) {
  const listeners = new Map();
  return {
    dataset: { resultKey },
    addEventListener: jasmine.createSpy("addEventListener").and.callFake((eventName, handler) => {
      listeners.set(eventName, handler);
    }),
    trigger(eventName, event = {}) {
      const handler = listeners.get(eventName);
      if (handler) {
        handler(event);
      }
    },
  };
}

describe("ResultsTableView", () => {
  it("renders empty state from store state", () => {
    const container = createContainer();
    const view = new ResultsTableView(container);

    view.render({
      results: [],
      visibleStrategies: null,
      selectedResultKey: null,
      sortState: { field: null, direction: "asc", hasSorted: false },
    });

    expect(container.innerHTML).toBe("<p>No results.</p>");
  });

  it("renders a result table and action log from explicit ui state", () => {
    const container = createContainer();
    const registry = createResultKeyRegistry();
    const result = {
      top_n: 4,
      tab: "Tab A",
      strat: "Fixed D",
      XIRR: 12.34,
      avg_age_y: 1.2,
      deposited: 2000,
      current: 2200,
      invested: 1500,
      depositCash: 300,
      saleCash: 200,
      returns: 10,
      log: [
        {
          date: "2026-01-01",
          action: "Deposit",
          qty: null,
          amount: 1000,
          deposited: 1000,
          current: 1000,
          invested: 0,
          depositCash: 1000,
          saleCash: 0,
          returns: 0,
        },
      ],
    };
    const state = {
      results: [result],
      visibleStrategies: null,
      selectedResultKey: registry.getKey(result),
      sortState: { field: null, direction: "asc", hasSorted: false },
    };
    const view = new ResultsTableView(container, null, registry);

    view.render(state);

    expect(container.innerHTML).toContain("<table class=\"results-table\">");
    expect(container.innerHTML).toContain("Tab A");
    expect(container.innerHTML).toContain("Action Log");
    expect(container.innerHTML).toContain("12.34 %");
  });

  it("filters strategies and keeps selection driven by the store", () => {
    const container = createContainer();
    const registry = createResultKeyRegistry();
    const resultA = {
      top_n: 1,
      tab: "Tab A",
      strat: "Fixed D",
      XIRR: 1,
      avg_age_y: 1,
      deposited: 1000,
      current: 1100,
      invested: 900,
      depositCash: 100,
      saleCash: 0,
      returns: 10,
    };
    const resultB = {
      top_n: 2,
      tab: "Tab B",
      strat: "Full S",
      XIRR: 2,
      avg_age_y: 1,
      deposited: 1000,
      current: 1200,
      invested: 900,
      depositCash: 100,
      saleCash: 0,
      returns: 20,
    };
    const uiState = createUiState({
      results: [resultA, resultB],
      visibleStrategies: new Set(["Missing"]),
      selectedResultKey: registry.getKey(resultA),
    });
    const view = new ResultsTableView(container, uiState, registry);

    view.render(uiState.getState());

    expect(container.innerHTML).toContain("No results for the selected strategies.");

    uiState.setVisibleStrategies(new Set(["Fixed D", "Full S"]));
    expect(container.innerHTML).toContain("Tab A");
    expect(container.innerHTML).toContain("Tab B");
  });

  it("sorts and feeds user interactions back into the ui state", () => {
    const container = createContainer();
    const registry = createResultKeyRegistry();
    const resultA = {
      top_n: 1,
      tab: "Tab A",
      strat: "Fixed D",
      XIRR: 2,
      avg_age_y: 1,
      deposited: 1000,
      current: 1100,
      invested: 900,
      depositCash: 100,
      saleCash: 0,
      returns: 10,
    };
    const resultB = {
      top_n: 2,
      tab: "Tab B",
      strat: "Full S",
      XIRR: 3,
      avg_age_y: 1,
      deposited: 1000,
      current: 1200,
      invested: 900,
      depositCash: 100,
      saleCash: 0,
      returns: 20,
    };
    const uiState = createUiState({
      results: [resultB, resultA],
      selectedResultKey: registry.getKey(resultA),
    });
    const view = new ResultsTableView(container, uiState, registry);
    const headers = [createHeaderElement("returns"), createHeaderElement("tab")];
    const link = createLinkElement(registry.getKey(resultA));

    container.setQueryResults("th[data-sort-field]", headers);
    container.setQueryResults(".tab-log-link", [link]);

    view.render(uiState.getState());
    headers[0].trigger("click");
    expect(uiState.getState().sortState).toEqual({
      field: "returns",
      direction: "asc",
      hasSorted: true,
    });

    link.trigger("click", { preventDefault: jasmine.createSpy("preventDefault") });
    expect(uiState.getState().selectedResultKey).toBe(registry.getKey(resultA));
  });
});
