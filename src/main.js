import { FIELD_SLUGS, REQUIRED_FIELD_SLUGS } from "./config/constants.js";
import { SpreadsheetIdExtractor } from "./core/SpreadsheetIdExtractor.js";
import { GoogleSheetsApiClient } from "./core/GoogleSheetsApiClient.js";
import { SheetRowParser } from "./core/SheetRowParser.js";
import { SheetHeaderValidator } from "./core/SheetHeaderValidator.js";
import { ProcessableTabsService } from "./services/ProcessableTabsService.js";
import { FirstNFilter } from "./core/FirstNFilter.js";
import { PortfolioMovementMapper } from "./core/PortfolioMovementMapper.js";
import { XirrCalculator } from "./core/XirrCalculator.js";
import { WeightedAgeCalculator } from "./core/WeightedAgeCalculator.js";
import { WeeklyInvestmentPolicy } from "./core/WeeklyInvestmentPolicy.js";
import { PortfolioResultsCalculator } from "./services/PortfolioResultsCalculator.js";
import { StatusView } from "./ui/StatusView.js";
import { ResultsTableView } from "./ui/ResultsTableView.js";
import { PageControlsController } from "./ui/PageControlsController.js";
import { createUiState } from "./ui/state/createUiState.js";
import { CalculationController } from "./app/CalculationController.js";
import { BulkFormInputParser } from "./parsers/BulkFormInputParser.js";

function bindButtonsToUiState(documentRef, uiState) {
  const loadButtonElement = documentRef.getElementById("btn-load-data");
  const calculateButtonElement = documentRef.getElementById("btn-calculate");

  const syncButtons = (state) => {
    if (loadButtonElement) {
      loadButtonElement.textContent = state.loadButtonLabel;
      loadButtonElement.disabled = state.isProcessing;
    }
    if (calculateButtonElement) {
      calculateButtonElement.disabled = state.isProcessing;
    }
  };

  const unsubscribe = uiState.subscribe((nextState, previousState) => {
    if (
      nextState.isProcessing !== previousState.isProcessing ||
      nextState.loadButtonLabel !== previousState.loadButtonLabel
    ) {
      syncButtons(nextState);
    }
  });

  syncButtons(uiState.getState());
  return unsubscribe;
}

export function bootstrap(documentRef = document, overrides = {}) {
  const {
    uiState: injectedUiState,
    createUiState: createUiStateFactory = createUiState,
    SpreadsheetIdExtractor: SpreadsheetIdExtractorClass = SpreadsheetIdExtractor,
    GoogleSheetsApiClient: GoogleSheetsApiClientClass = GoogleSheetsApiClient,
    SheetRowParser: SheetRowParserClass = SheetRowParser,
    SheetHeaderValidator: SheetHeaderValidatorClass = SheetHeaderValidator,
    ProcessableTabsService: ProcessableTabsServiceClass = ProcessableTabsService,
    FirstNFilter: FirstNFilterClass = FirstNFilter,
    PortfolioMovementMapper: PortfolioMovementMapperClass = PortfolioMovementMapper,
    XirrCalculator: XirrCalculatorClass = XirrCalculator,
    WeightedAgeCalculator: WeightedAgeCalculatorClass = WeightedAgeCalculator,
    PortfolioResultsCalculator: PortfolioResultsCalculatorClass = PortfolioResultsCalculator,
    StatusView: StatusViewClass = StatusView,
    ResultsTableView: ResultsTableViewClass = ResultsTableView,
    PageControlsController: PageControlsControllerClass = PageControlsController,
    CalculationController: CalculationControllerClass = CalculationController,
    BulkFormInputParser: BulkFormInputParserClass = BulkFormInputParser,
  } = overrides;

  const uiState = injectedUiState || createUiStateFactory();
  const spreadsheetIdExtractor = new SpreadsheetIdExtractorClass();
  const sheetsApiClient = new GoogleSheetsApiClientClass();
  const rowParser = new SheetRowParserClass(FIELD_SLUGS);
  const headerValidator = new SheetHeaderValidatorClass(REQUIRED_FIELD_SLUGS);
  const processableTabsService = new ProcessableTabsServiceClass({
    sheetsApiClient,
    headerValidator,
    rowParser,
  });

  const portfolioResultsCalculator = new PortfolioResultsCalculatorClass({
    firstNFilter: new FirstNFilterClass(),
    movementMapper: new PortfolioMovementMapperClass(),
    weeklyInvestmentPolicy: new WeeklyInvestmentPolicy(),
    xirrCalculator: new XirrCalculatorClass(),
    weightedAgeCalculator: new WeightedAgeCalculatorClass(),
  });

  const controller = new CalculationControllerClass({
    spreadsheetIdExtractor,
    processableTabsService,
    portfolioResultsCalculator,
    statusView: new StatusViewClass(documentRef.getElementById("status")),
    uiState,
    loadButtonElement: documentRef.getElementById("btn-load-data"),
    calculateButtonElement: documentRef.getElementById("btn-calculate"),
    spreadsheetUrlElement: documentRef.getElementById("spreadsheet-url"),
    apiKeyElement: documentRef.getElementById("api-key"),
    firstNElement: documentRef.getElementById("first-n"),
    minDepositElement: documentRef.getElementById("min-deposit"),
    minInvestmentElement: documentRef.getElementById("min-investment"),
    smoothNElement: documentRef.getElementById("smooth-n"),
    bulkInputElement: documentRef.getElementById("bulk-input"),
    bulkFormInputParser: new BulkFormInputParserClass(),
  });

  new ResultsTableViewClass(documentRef.getElementById("results"), uiState);
  const pageControlsController = new PageControlsControllerClass(
    documentRef,
    uiState,
    documentRef.querySelectorAll(".strategy-toggle-input"),
  );

  controller.bind();
  pageControlsController.bind();
  bindButtonsToUiState(documentRef, uiState);

  return controller;
}
