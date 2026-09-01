import {afterEach, describe, expect, it} from "vitest";
import {getUndoRootID} from "../../src/protyle/undo/globalUndo";

describe("embedded block undo ownership", () => {
    afterEach(() => {
        document.body.replaceChildren();
        getSelection()?.removeAllRanges();
    });

    it("routes an embedded selection to the source document root", () => {
        const editor = document.createElement("div");
        editor.innerHTML = `<div class="protyle-wysiwyg__embed" data-root-id="source-root"><div data-node-id="source-block">text</div></div>`;
        document.body.append(editor);
        const sourceBlock = editor.querySelector("[data-node-id='source-block']")!;
        const range = document.createRange();
        range.selectNodeContents(sourceBlock);
        range.collapse(true);

        expect(getUndoRootID({
            block: {rootID: "query-root"},
            toolbar: {},
            wysiwyg: {element: editor},
        } as IProtyle, range)).toBe("source-root");
    });

    it("keeps the editor document root for ordinary selections", () => {
        const editor = document.createElement("div");
        editor.innerHTML = `<div data-node-id="query-block">text</div>`;
        document.body.append(editor);
        const queryBlock = editor.firstElementChild!;
        const range = document.createRange();
        range.selectNodeContents(queryBlock);
        range.collapse(true);

        expect(getUndoRootID({
            block: {rootID: "query-root"},
            toolbar: {},
            wysiwyg: {element: editor},
        } as IProtyle, range)).toBe("query-root");
    });
});
