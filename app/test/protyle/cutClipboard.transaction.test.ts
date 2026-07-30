import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/protyle/wysiwyg/index.copy", () => ({
    emojiToMd: vi.fn(),
    handleCopy: async (_protyle: IProtyle, event: {clipboardData: DataTransfer}) => {
        event.clipboardData.setData("text/plain", "copied");
        event.clipboardData.setData("text/html", "<p>copied</p>");
    },
}));

vi.mock("../../src/dialog/message", () => ({
    showMessage: vi.fn(),
}));

vi.mock("../../src/util/checkBlockRef", () => ({
    confirmBlockRefForBlocks: vi.fn(),
}));

vi.mock("../../src/protyle/wysiwyg/transaction/submit", () => ({
    transaction: vi.fn(),
}));

import {confirmBlockRefForBlocks} from "../../src/util/checkBlockRef";
import {transaction} from "../../src/protyle/wysiwyg/transaction/submit";
import {writeBlockDOMClipboard} from "../../src/protyle/util/compatibility";
import {handleCut} from "../../src/protyle/wysiwyg/index.cut";

class TestDataTransfer {
    private readonly values = new Map<string, string>();

    getData(type: string) {
        return this.values.get(type) || "";
    }

    setData(type: string, value: string) {
        this.values.set(type, value);
    }
}

class TestClipboardItem {
    constructor(readonly values: Record<string, string>) {
    }
}

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");
const originalDataTransfer = Object.getOwnPropertyDescriptor(globalThis, "DataTransfer");
const originalSiyuan = Object.getOwnPropertyDescriptor(window, "siyuan");

const restoreProperty = (target: object, key: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
        Object.defineProperty(target, key, descriptor);
        return;
    }
    Reflect.deleteProperty(target, key);
};

beforeEach(() => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            ctrlIsPressed: true,
            config: {system: {container: "browser"}},
            languages: {clipboardPermissionDenied: "Clipboard access was denied"},
        },
    });
    Object.defineProperty(globalThis, "ClipboardItem", {
        configurable: true,
        value: TestClipboardItem,
    });
    Object.defineProperty(globalThis, "DataTransfer", {
        configurable: true,
        value: TestDataTransfer,
    });
});

afterEach(() => {
    restoreProperty(navigator, "clipboard", originalClipboard);
    restoreProperty(globalThis, "ClipboardItem", originalClipboardItem);
    restoreProperty(globalThis, "DataTransfer", originalDataTransfer);
    restoreProperty(window, "siyuan", originalSiyuan);
    document.body.replaceChildren();
});

describe("clipboard-backed mutations", () => {
    it("reports a rejected rich clipboard write", async () => {
        const write = vi.fn().mockRejectedValue(new Error("permission denied"));
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {write},
        });

        await expect(writeBlockDOMClipboard({text: "copied", html: "<p>copied</p>"})).resolves.toBe(false);
        expect(write).toHaveBeenCalledOnce();
    });

    it("does not remove a selected range when the cut clipboard write fails", async () => {
        const write = vi.fn().mockRejectedValue(new Error("permission denied"));
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {write},
        });

        const editor = document.createElement("div");
        const block = document.createElement("div");
        block.dataset.nodeId = "20260730120000-test";
        block.dataset.type = "NodeParagraph";
        const editable = document.createElement("div");
        editable.textContent = "alpha";
        block.append(editable);
        editor.append(block);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(editable.firstChild!, 0);
        range.setEnd(editable.firstChild!, 2);
        getSelection().removeAllRanges();
        getSelection().addRange(range);

        await handleCut({
            disabled: false,
            options: {render: {}},
            wysiwyg: {element: editor},
        } as IProtyle, {
            target: editable,
            clipboardData: new DataTransfer(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });

        expect(write).toHaveBeenCalledOnce();
        expect(editable.textContent).toBe("alpha");
    });

    it("uses the already approved reference decision for a cross-block cut", async () => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {write: vi.fn().mockResolvedValue(undefined)},
        });
        vi.mocked(confirmBlockRefForBlocks).mockResolvedValue(true);

        const editor = document.createElement("div");
        const first = document.createElement("div");
        first.dataset.nodeId = "20260730120000-first";
        first.dataset.type = "NodeParagraph";
        const firstEditable = document.createElement("div");
        firstEditable.textContent = "alpha";
        first.append(firstEditable);
        const second = document.createElement("div");
        second.dataset.nodeId = "20260730120000-second";
        second.dataset.type = "NodeParagraph";
        const secondEditable = document.createElement("div");
        secondEditable.textContent = "bravo";
        second.append(secondEditable);
        editor.append(first, second);
        document.body.append(editor);

        const range = document.createRange();
        range.setStart(firstEditable.firstChild!, 0);
        range.setEnd(secondEditable.firstChild!, 5);
        getSelection().removeAllRanges();
        getSelection().addRange(range);

        await handleCut({
            disabled: false,
            block: {parentID: "document"},
            options: {render: {}},
            hint: {render: vi.fn()},
            lute: {SpinBlockDOM: (html: string) => html},
            wysiwyg: {element: editor},
        } as IProtyle, {
            target: firstEditable,
            clipboardData: new DataTransfer(),
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });

        expect(confirmBlockRefForBlocks).toHaveBeenCalledOnce();
        expect(transaction).toHaveBeenCalledOnce();
    });
});
