import {afterEach, describe, it} from "node:test";
import {strict as assert} from "node:assert";
import {Window} from "happy-dom";
import {getButtonElement, getInputElement} from "../../../src/util/DOM/queryFormElements";

const inputConstructorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLInputElement");
const buttonConstructorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLButtonElement");

const restoreConstructor = (name: string, descriptor: PropertyDescriptor | undefined) => {
    if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, name);
};

afterEach(() => {
    restoreConstructor("HTMLInputElement", inputConstructorDescriptor);
    restoreConstructor("HTMLButtonElement", buttonConstructorDescriptor);
});

describe("form element queries", () => {
    it("returns elements only when their runtime type matches", () => {
        const testWindow = new Window();
        Object.defineProperty(globalThis, "HTMLInputElement", {configurable: true, value: testWindow.HTMLInputElement});
        Object.defineProperty(globalThis, "HTMLButtonElement", {configurable: true, value: testWindow.HTMLButtonElement});
        const container = testWindow.document.createElement("div");
        container.innerHTML = '<input class="name"><button class="confirm"></button><span class="other"></span>';

        assert.equal(getInputElement(container, ".name"), container.querySelector(".name"));
        assert.equal(getButtonElement(container, ".confirm"), container.querySelector(".confirm"));
        assert.equal(getInputElement(container, ".other"), null);
        assert.equal(getButtonElement(container, ".missing"), null);
    });
});
