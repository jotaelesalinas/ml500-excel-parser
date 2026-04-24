export class InputForm {
    constructor({ spreadsheetUrlInput, apiKeyInput, firstNInput, bulkInput, calculateButton }) {
        this.spreadsheetUrlInput = spreadsheetUrlInput;
        this.apiKeyInput = apiKeyInput;
        this.firstNInput = firstNInput;
        this.bulkInput = bulkInput;
        this.calculateButton = calculateButton;
    }

    getValues() {
        return {
            spreadsheetUrl: this.spreadsheetUrlInput.value.trim(),
            apiKey: this.apiKeyInput.value.trim(),
            firstNRaw: this.firstNInput.value.trim(),
            bulkInputText: this.bulkInput.value,
        };
    }

    applyBulkValues({ spreadsheetUrl, apiKey, firstN }) {
        if (spreadsheetUrl) {
            this.spreadsheetUrlInput.value = spreadsheetUrl;
        }
        if (apiKey) {
            this.apiKeyInput.value = apiKey;
        }
        if (firstN) {
            this.firstNInput.value = firstN;
        }
    }

    parseFirstNValues() {
        return this.firstNInput.value
            .trim()
            .split(/\s*,\s*/g)
            .map(Number)
            .filter(value => value > 0);
    }

    setCalculating(isCalculating) {
        this.calculateButton.disabled = isCalculating;
    }

    onCalculate(handler) {
        this.calculateButton.addEventListener("click", handler);
    }
}
