import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/protyle/wysiwyg/remove", async (importOriginal) => ({
    ...await importOriginal<typeof import("../../src/protyle/wysiwyg/remove")>(),
    removeCrossBlockRange: vi.fn(),
}));

import {removeCrossBlockRange} from "../../src/protyle/wysiwyg/remove";
import {deleteKeyMiddleware} from "../../src/protyle/wysiwyg/keydown.delete";

afterEach(() => {
    vi.clearAllMocks();
});

const block = (id: string, text: string) => {
    const element = document.createElement("div");
    element.dataset.nodeId = id;
    element.dataset.type = "NodeParagraph";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    editable.textContent = text;
    element.append(editable);
    return element;
};

describe("cross-block Delete and Backspace dispatch", () => {
    it.each(["Delete", "Backspace"])("delegates %s to the shared cross-block transaction", async (key) => {
        const editor = document.createElement("div");
        editor.className = "protyle-wysiwyg";
        const first = block("first", "alpha");
        const second = block("second", "bravo");
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(first.firstChild!.firstChild!, 2);
        range.setEnd(second.firstChild!.firstChild!, 3);
        const event = {
            altKey: false,
            key,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as KeyboardEvent;
        const controller = new AbortController();
        const intentEventBus = {emit: vi.fn()};
        const protyle = {
            id: "editor-1",
            app: {plugins: [{eventBus: intentEventBus}]},
            wysiwyg: {element: editor},
        } as IProtyle;

        await deleteKeyMiddleware(event, protyle, first, range, controller);

        expect(vi.mocked(removeCrossBlockRange)).toHaveBeenCalledOnce();
        expect(vi.mocked(removeCrossBlockRange)).toHaveBeenCalledWith(
            expect.anything(), range, first, second,
        );
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(controller.signal.aborted).toBe(true);
        expect(intentEventBus.emit).toHaveBeenCalledWith("user-protyle-operation-intent", {
            editorId: "editor-1",
            intent: expect.objectContaining({
                actor: "user",
                surface: "editor",
                source: "keyboard",
                operation: "delete-cross-block-selection",
                trigger: key,
                startBlockId: "first",
                endBlockId: "second",
                referenceTargetCount: 1,
            }),
        });
        editor.remove();
    });
});
