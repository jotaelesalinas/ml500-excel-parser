# Frontend Architecture

This app keeps the UI framework-free and splits responsibilities into a few explicit layers:

- `src/app/CalculationController.js` owns application flow, validation, loading, and calculation.
- `src/ui/state/createUiState.js` is the single source of truth for UI-only state such as input mode, selected result, sort state, visible strategies, processing state, and button labels.
- `src/ui/PageControlsController.js` owns the top-level page controls and synchronizes them with the UI state.
- `src/ui/ResultsTableView.js` is a DOM adapter that renders the results area from UI state and feeds sort/selection actions back into the store.
- `src/ui/results/` contains pure helpers and markup builders for result sorting, key generation, log grouping, and HTML formatting.

Keep new UI behavior inside these boundaries. If a change needs shared UI state, add it to `createUiState()` rather than introducing hidden fields in a view or controller.
