import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {Window} from "happy-dom";
import {serializeInlineRangeHTML} from "../../src/protyle/wysiwyg/keydown/content/serializeInlineRangeHTML";

const htmlElementDescriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");

afterEach(() => {
    if (htmlElementDescriptor) {
        Object.defineProperty(globalThis, "HTMLElement", htmlElementDescriptor);
        return;
    }
    Reflect.deleteProperty(globalThis, "HTMLElement");
});

describe("keydown inline content serialization", () => {
    it("preserves text and element nodes in range order", () => {
        const testWindow = new Window();
        Object.defineProperty(globalThis, "HTMLElement", {configurable: true, value: testWindow.HTMLElement});
        const container = testWindow.document.createElement("div");
        container.innerHTML = "plain<strong>bold</strong>tail";
        const range = testWindow.document.createRange();
        range.selectNodeContents(container);

        assert.equal(serializeInlineRangeHTML(range), "plain<strong>bold</strong>tail");
    });
});
