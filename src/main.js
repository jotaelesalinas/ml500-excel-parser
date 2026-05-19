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
import { CalculationController } from "./app/CalculationController.js";
import { BulkFormInputParser } from "./parsers/BulkFormInputParser.js";

export function bootstrap(documentRef = document) {
  const spreadsheetIdExtractor = new SpreadsheetIdExtractor();
  const sheetsApiClient = new GoogleSheetsApiClient();
  const rowParser = new SheetRowParser(FIELD_SLUGS);
  const headerValidator = new SheetHeaderValidator(REQUIRED_FIELD_SLUGS);
  const processableTabsService = new ProcessableTabsService({
    sheetsApiClient,
    headerValidator,
    rowParser,
  });

  const portfolioResultsCalculator = new PortfolioResultsCalculator({
    firstNFilter: new FirstNFilter(),
    movementMapper: new PortfolioMovementMapper(),
    weeklyInvestmentPolicy: new WeeklyInvestmentPolicy(),
    xirrCalculator: new XirrCalculator(),
    weightedAgeCalculator: new WeightedAgeCalculator(),
  });

  const controller = new CalculationController({
    spreadsheetIdExtractor,
    processableTabsService,
    portfolioResultsCalculator,
    statusView: new StatusView(documentRef.getElementById("status")),
    resultsTableView: new ResultsTableView(documentRef.getElementById("results")),
    loadButtonElement: documentRef.getElementById("btn-load-data"),
    calculateButtonElement: documentRef.getElementById("btn-calculate"),
    spreadsheetUrlElement: documentRef.getElementById("spreadsheet-url"),
    apiKeyElement: documentRef.getElementById("api-key"),
    firstNElement: documentRef.getElementById("first-n"),
    minDepositElement: documentRef.getElementById("min-deposit"),
    minInvestmentElement: documentRef.getElementById("min-investment"),
    bulkInputElement: documentRef.getElementById("bulk-input"),
    bulkFormInputParser: new BulkFormInputParser(),
  });

  controller.bind();
  return controller;
}
