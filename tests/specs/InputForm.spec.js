import { InputForm } from "../../src/ui/InputForm.js";

describe("InputForm", () => {
    function createForm() {
        const spreadsheetUrlInput = document.createElement("input");
        const apiKeyInput = document.createElement("input");
        const firstNInput = document.createElement("input");
        const bulkInput = document.createElement("textarea");
        const calculateButton = document.createElement("button");

        return {
            spreadsheetUrlInput,
            apiKeyInput,
            firstNInput,
            bulkInput,
            calculateButton,
            form: new InputForm({ spreadsheetUrlInput, apiKeyInput, firstNInput, bulkInput, calculateButton }),
        };
    }

    it("returns trimmed values and raw bulk input", () => {
        const { form, spreadsheetUrlInput, apiKeyInput, firstNInput, bulkInput } = createForm();
        spreadsheetUrlInput.value = " https://docs.google.com/spreadsheets/d/abc ";
        apiKeyInput.value = " key ";
        firstNInput.value = " 4, 10 ";
        bulkInput.value = " a\nb\nc ";

        expect(form.getValues()).toEqual({
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/abc",
            apiKey: "key",
            firstNRaw: "4, 10",
            bulkInputText: " a\nb\nc ",
        });
    });

    it("applies only non-empty bulk values", () => {
        const { form, spreadsheetUrlInput, apiKeyInput, firstNInput } = createForm();
        spreadsheetUrlInput.value = "url-old";
        apiKeyInput.value = "key-old";
        firstNInput.value = "1";

        form.applyBulkValues({
            spreadsheetUrl: "",
            apiKey: "key-new",
            firstN: "4, 10",
        });

        expect(spreadsheetUrlInput.value).toBe("url-old");
        expect(apiKeyInput.value).toBe("key-new");
        expect(firstNInput.value).toBe("4, 10");
    });

    it("parses positive first-n values", () => {
        const { form, firstNInput } = createForm();
        firstNInput.value = "4, 0, -2, 10, nope, 2";

        expect(form.parseFirstNValues()).toEqual([4, 10, 2]);
    });

    it("toggles the calculate button disabled state", () => {
        const { form, calculateButton } = createForm();

        form.setCalculating(true);
        expect(calculateButton.disabled).toBeTrue();

        form.setCalculating(false);
        expect(calculateButton.disabled).toBeFalse();
    });

    it("registers the calculate handler on the button", () => {
        const { form, calculateButton } = createForm();
        const handler = jasmine.createSpy("handler");

        form.onCalculate(handler);
        calculateButton.click();

        expect(handler).toHaveBeenCalled();
    });
});
