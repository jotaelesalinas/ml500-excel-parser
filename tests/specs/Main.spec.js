import { createApp } from "../../src/main.js";
import { AppController } from "../../src/AppController.js";

describe("createApp", () => {
    it("creates a wired AppController instance from the document", () => {
        const documentRef = createDocumentFixture();

        const app = createApp(documentRef);

        expect(app instanceof AppController).toBeTrue();
        expect(app.form.spreadsheetUrlInput).toBe(documentRef.getElementById("spreadsheet-url"));
        expect(app.form.apiKeyInput).toBe(documentRef.getElementById("api-key"));
        expect(app.form.firstNInput).toBe(documentRef.getElementById("first-n"));
        expect(app.form.bulkInput).toBe(documentRef.getElementById("bulk-input"));
        expect(app.form.calculateButton).toBe(documentRef.getElementById("btn-calculate"));
        expect(app.statusView.element).toBe(documentRef.getElementById("status"));
        expect(app.resultsContainer).toBe(documentRef.getElementById("results"));
    });
});

function createDocumentFixture() {
    const root = document.createElement("div");
    root.innerHTML = `
        <input id="spreadsheet-url">
        <input id="api-key">
        <input id="first-n">
        <textarea id="bulk-input"></textarea>
        <button id="btn-calculate"></button>
        <div id="status"></div>
        <div id="results"></div>
    `;

    return {
        getElementById: id => root.querySelector(`#${id}`),
    };
}
