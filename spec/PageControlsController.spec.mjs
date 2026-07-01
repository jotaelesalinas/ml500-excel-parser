import { PageControlsController } from "../src/ui/PageControlsController.js";
import { createUiState } from "../src/ui/state/createUiState.js";

function createElement({ value = "", checked = false } = {}) {
  const listeners = new Map();
  return {
    value,
    checked,
    dataset: {},
    style: {},
    classList: {
      add: jasmine.createSpy("add"),
      remove: jasmine.createSpy("remove"),
      toggle(cls, isActive) {
        this[isActive ? "add" : "remove"](cls);
      },
    },
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

function createDocumentStub() {
  const tabs = [
    Object.assign(createElement(), { dataset: { mode: "fields" } }),
    Object.assign(createElement(), { dataset: { mode: "paste" } }),
  ];
  const fieldsModeElement = createElement();
  const pasteModeElement = createElement();
  const selectAllElement = createElement();
  const selectNoneElement = createElement();
  const checkboxA = createElement({ value: "Fixed D", checked: true });
  const checkboxB = createElement({ value: "Full S", checked: true });

  const elements = {
    "input-fields-mode": fieldsModeElement,
    "input-paste-mode": pasteModeElement,
    "btn-select-all": selectAllElement,
    "btn-select-none": selectNoneElement,
  };

  return {
    tabs,
    fieldsModeElement,
    pasteModeElement,
    selectAllElement,
    selectNoneElement,
    checkboxA,
    checkboxB,
    getElementById: jasmine.createSpy("getElementById").and.callFake((id) => elements[id] || null),
    querySelectorAll: jasmine.createSpy("querySelectorAll").and.callFake((selector) => {
      if (selector === ".input-mode-tab") {
        return tabs;
      }
      if (selector === ".strategy-toggle-input") {
        return [checkboxA, checkboxB];
      }
      return [];
    }),
  };
}

describe("PageControlsController", () => {
  it("syncs input mode tabs into the ui state", () => {
    const documentStub = createDocumentStub();
    const uiState = createUiState();
    const controller = new PageControlsController(documentStub, uiState, [documentStub.checkboxA, documentStub.checkboxB]);

    controller.bind();
    documentStub.tabs[1].trigger("click");

    expect(uiState.getState().inputMode).toBe("paste");
    expect(documentStub.fieldsModeElement.style.display).toBe("none");
    expect(documentStub.pasteModeElement.style.display).toBe("");
  });

  it("selects all strategies and none strategies", () => {
    const documentStub = createDocumentStub();
    const uiState = createUiState({ visibleStrategies: new Set(["Fixed D"]) });
    const controller = new PageControlsController(documentStub, uiState, [documentStub.checkboxA, documentStub.checkboxB]);

    controller.bind();
    documentStub.selectAllElement.trigger("click", { preventDefault: jasmine.createSpy("preventDefault") });

    expect(uiState.getState().visibleStrategies).toBeNull();
    expect(documentStub.checkboxA.checked).toBeTrue();
    expect(documentStub.checkboxB.checked).toBeTrue();

    documentStub.selectNoneElement.trigger("click", { preventDefault: jasmine.createSpy("preventDefault") });

    expect(Array.from(uiState.getState().visibleStrategies)).toEqual([]);
    expect(documentStub.checkboxA.checked).toBeFalse();
    expect(documentStub.checkboxB.checked).toBeFalse();
  });

  it("keeps visible strategies in sync when checkboxes change", () => {
    const documentStub = createDocumentStub();
    const uiState = createUiState();
    const controller = new PageControlsController(documentStub, uiState, [documentStub.checkboxA, documentStub.checkboxB]);

    controller.bind();
    documentStub.checkboxB.checked = false;
    documentStub.checkboxB.trigger("change");

    expect(Array.from(uiState.getState().visibleStrategies)).toEqual(["Fixed D"]);
  });
});
