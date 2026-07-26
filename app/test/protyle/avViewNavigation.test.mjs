import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {Window} from "happy-dom";
import {createOpenViewMenuOutcome} from "../../src/protyle/render/av/view/navigation";

describe("AV view navigation", () => {
    it("preserves validated elements in the Panel navigation command", () => {
        const testWindow = new Window();
        const blockElement = testWindow.document.createElement("div");
        const menuElement = testWindow.document.createElement("button");

        const outcome = createOpenViewMenuOutcome(blockElement, menuElement);

        assert.equal(outcome.kind, "open-view-menu");
        assert.equal(outcome.blockElement, blockElement);
        assert.equal(outcome.element, menuElement);
    });
});
