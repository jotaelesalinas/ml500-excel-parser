import { createResultKeyRegistry } from "./results/resultKeyRegistry.js";
import { sortResults } from "./results/sortResults.js";
import { buildSummaryMarkup } from "./results/buildSummaryMarkup.js";
import { buildResultsTableMarkup } from "./results/buildResultsTableMarkup.js";
import { buildActionLogMarkup } from "./results/buildActionLogMarkup.js";

export class ResultsTableView {
  constructor(containerElement, uiState = null, resultKeyRegistry = createResultKeyRegistry()) {
    this.containerElement = containerElement;
    this.uiState = uiState;
    this.resultKeyRegistry = resultKeyRegistry;

    if (this.uiState) {
      this.unsubscribe = this.uiState.subscribe((nextState, previousState) => {
        if (this.#shouldRender(nextState, previousState)) {
          this.render(nextState);
        }
      });
    }
  }

  render(state = null) {
    const resolvedState = state || this.uiState?.getState();
    if (!resolvedState) {
      throw new Error("ResultsTableView.render requires state or uiState");
    }

    const results = Array.isArray(resolvedState.results) ? resolvedState.results : [];
    const filteredResults = resolvedState.visibleStrategies
      ? results.filter((result) => resolvedState.visibleStrategies.has(result.strat))
      : results;

    if (filteredResults.length === 0) {
      this.containerElement.innerHTML = results.length === 0
        ? "<p>No results.</p>"
        : "<p>No results for the selected strategies.</p>";
      return;
    }

    const sortedResults = sortResults(filteredResults, resolvedState.sortState);
    const selectedResult = this.#getSelectedResult(sortedResults, resolvedState.selectedResultKey);
    const summaryHtml = buildSummaryMarkup(sortedResults);
    const tableHtml = buildResultsTableMarkup(sortedResults, resolvedState.sortState, this.resultKeyRegistry);
    const logHtml = buildActionLogMarkup(selectedResult);

    this.containerElement.innerHTML = `${summaryHtml}${tableHtml}${logHtml}`;
    this.#bindSortHeaderEvents();
    this.#bindTabLinkEvents();
  }

  #shouldRender(nextState, previousState) {
    if (!previousState) {
      return true;
    }

    return (
      nextState.results !== previousState.results ||
      nextState.visibleStrategies !== previousState.visibleStrategies ||
      nextState.selectedResultKey !== previousState.selectedResultKey ||
      nextState.sortState.field !== previousState.sortState.field ||
      nextState.sortState.direction !== previousState.sortState.direction ||
      nextState.sortState.hasSorted !== previousState.sortState.hasSorted
    );
  }

  #getSelectedResult(results, selectedResultKey) {
    if (!selectedResultKey) {
      return null;
    }

    return results.find((result) => this.resultKeyRegistry.getKey(result) === selectedResultKey) || null;
  }

  #bindSortHeaderEvents() {
    if (typeof this.containerElement.querySelectorAll !== "function") {
      return;
    }

    const headers = this.containerElement.querySelectorAll("th[data-sort-field]");
    headers.forEach((header) => {
      const sortField = header.dataset.sortField;
      if (!sortField) {
        return;
      }

      header.addEventListener("click", () => {
        this.uiState?.setSort(sortField);
      });

      header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.uiState?.setSort(sortField);
      });
    });
  }

  #bindTabLinkEvents() {
    if (typeof this.containerElement.querySelectorAll !== "function") {
      return;
    }

    const links = this.containerElement.querySelectorAll(".tab-log-link");
    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const resultKey = link.dataset.resultKey;
        if (!resultKey) {
          return;
        }

        this.uiState?.setSelectedResultKey(resultKey);
        const logHeader = this.containerElement.querySelector("#tab-log-header");
        if (logHeader) {
          logHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }
}
