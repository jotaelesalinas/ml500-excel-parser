import { AppConfig } from "./config.js";
import { AppController } from "./AppController.js";
import { PortfolioCalculator } from "./calculators/PortfolioCalculator.js";
import { FinancialMetrics } from "./calculators/FinancialMetrics.js";
import { SpreadsheetIdExtractor, SheetRowParser, BulkFormInputParser } from "./parsers/SpreadsheetInputParser.js";
import { ResultsTableRenderer } from "./renderers/ResultsTableRenderer.js";
import { GoogleSheetsService } from "./services/GoogleSheetsService.js";
import { InputForm } from "./ui/InputForm.js";
import { StatusView } from "./ui/StatusView.js";

export function createApp(documentRef = document) {
    const todayProvider = () => AppConfig.today();
    const financialMetrics = new FinancialMetrics(todayProvider);
    const portfolioCalculator = new PortfolioCalculator(financialMetrics, todayProvider);

    return new AppController({
        form: new InputForm({
            spreadsheetUrlInput: documentRef.getElementById("spreadsheet-url"),
            apiKeyInput: documentRef.getElementById("api-key"),
            firstNInput: documentRef.getElementById("first-n"),
            bulkInput: documentRef.getElementById("bulk-input"),
            calculateButton: documentRef.getElementById("btn-calculate"),
        }),
        statusView: new StatusView(documentRef.getElementById("status")),
        resultsContainer: documentRef.getElementById("results"),
        spreadsheetIdExtractor: new SpreadsheetIdExtractor(),
        bulkFormInputParser: new BulkFormInputParser(),
        googleSheetsService: new GoogleSheetsService(new SheetRowParser()),
        portfolioCalculator,
        resultsTableRenderer: new ResultsTableRenderer(),
    });
}
