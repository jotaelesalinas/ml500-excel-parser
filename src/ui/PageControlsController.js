export class PageControlsController {
  constructor(documentRef, uiState, strategyCheckboxElements) {
    this.documentRef = documentRef;
    this.uiState = uiState;
    this.strategyCheckboxElements = [...strategyCheckboxElements];
    this.inputModeTabs = [...documentRef.querySelectorAll(".input-mode-tab")];
    this.fieldsModeElement = documentRef.getElementById("input-fields-mode");
    this.pasteModeElement = documentRef.getElementById("input-paste-mode");
    this.selectAllElement = documentRef.getElementById("btn-select-all");
    this.selectNoneElement = documentRef.getElementById("btn-select-none");
    this.unsubscribe = null;
  }

  bind() {
    this.bindInputModeTabs();
    this.bindSelectAllNone();
    this.bindStrategyFilters();
    this.unsubscribe = this.uiState.subscribe((nextState, previousState) => {
      if (
        nextState.inputMode !== previousState.inputMode ||
        nextState.visibleStrategies !== previousState.visibleStrategies
      ) {
        this.syncDomFromState(nextState);
      }
    });
    this.syncDomFromState(this.uiState.getState());
  }

  bindInputModeTabs() {
    this.inputModeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.dataset.mode === "paste" ? "paste" : "fields";
        this.uiState.setInputMode(mode);
      });
    });
  }

  bindSelectAllNone() {
    this.selectAllElement?.addEventListener("click", (event) => {
      event.preventDefault();
      this.strategyCheckboxElements.forEach((checkbox) => {
        checkbox.checked = true;
      });
      this.syncVisibleStrategiesFromCheckboxes();
    });

    this.selectNoneElement?.addEventListener("click", (event) => {
      event.preventDefault();
      this.strategyCheckboxElements.forEach((checkbox) => {
        checkbox.checked = false;
      });
      this.syncVisibleStrategiesFromCheckboxes();
    });
  }

  bindStrategyFilters() {
    this.strategyCheckboxElements.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.syncVisibleStrategiesFromCheckboxes();
      });
    });
  }

  syncDomFromState(state) {
    this.inputModeTabs.forEach((tab) => {
      const isActive = (tab.dataset.mode === "paste" ? "paste" : "fields") === state.inputMode;
      tab.classList.toggle("active", isActive);
    });

    if (this.fieldsModeElement) {
      this.fieldsModeElement.style.display = state.inputMode === "fields" ? "" : "none";
    }
    if (this.pasteModeElement) {
      this.pasteModeElement.style.display = state.inputMode === "paste" ? "" : "none";
    }

    const visibleStrategies = state.visibleStrategies;
    this.strategyCheckboxElements.forEach((checkbox) => {
      checkbox.checked = visibleStrategies == null || visibleStrategies.has(checkbox.value);
    });
  }

  syncVisibleStrategiesFromCheckboxes() {
    const checkedValues = this.strategyCheckboxElements.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
    const allChecked = checkedValues.length === this.strategyCheckboxElements.length;
    this.uiState.setVisibleStrategies(allChecked ? null : new Set(checkedValues));
  }
}
