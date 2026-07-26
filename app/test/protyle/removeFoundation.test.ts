import {describe, expect, it} from "vitest";
import {getOperationParentID} from "../../src/protyle/wysiwyg/getBlock";
import {moveToPrevious} from "../../src/protyle/wysiwyg/remove/focus";

describe("Protyle removal foundation", () => {
    it("resolves normal, embedded, and top-level operation parents", () => {
        const parent = document.createElement("div");
        parent.dataset.nodeId = "parent";
        const child = document.createElement("div");
        child.dataset.nodeId = "child";
        parent.append(child);
        expect(getOperationParentID(child, "root")).toBe("parent");

        const embed = document.createElement("div");
        embed.className = "protyle-wysiwyg__embed";
        embed.dataset.allowChildOperation = "true";
        embed.dataset.id = "embed-target";
        const embeddedChild = document.createElement("div");
        embeddedChild.dataset.nodeId = "embedded-child";
        embed.append(embeddedChild);
        expect(getOperationParentID(embeddedChild, "root")).toBe("embed-target");

        const editor = document.createElement("div");
        const topLevel = document.createElement("div");
        editor.append(topLevel);
        expect(getOperationParentID(topLevel, "root")).toBe("root");
    });

    it("keeps the range unchanged when the removal does not move backward", () => {
        const container = document.createElement("div");
        const block = document.createElement("div");
        container.append(block);
        const range = document.createRange();
        range.selectNode(block);

        expect(moveToPrevious(block, range, false)).toBeUndefined();
        expect(range.commonAncestorContainer).toBe(container);
    });

    it("moves a delete range to the end of the previous editable block", () => {
        const container = document.createElement("div");
        const previous = document.createElement("div");
        previous.dataset.nodeId = "previous";
        previous.dataset.type = "NodeParagraph";
        const editable = document.createElement("div");
        editable.textContent = "previous text";
        previous.append(editable);
        const current = document.createElement("div");
        current.dataset.nodeId = "current";
        container.append(previous, current);
        const range = document.createRange();
        range.selectNode(current);

        expect(moveToPrevious(current, range, true)).toBe(range);
        expect(range.endContainer).toBe(editable.firstChild);
        expect(range.endOffset).toBe("previous text".length);
    });
});
