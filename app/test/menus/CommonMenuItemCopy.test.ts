import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    copyTextByType: vi.fn(),
    fetchSyncPost: vi.fn(async () => ({data: {content: "# Markdown"}})),
    focusBlock: vi.fn(),
    writeText: vi.fn(),
}));

vi.mock("../../src/menus/commonMenuItem/copy/imports", () => ({
    copyTextByType: mocks.copyTextByType,
    fetchSyncPost: mocks.fetchSyncPost,
    focusBlock: mocks.focusBlock,
    getSiyuanConfig: () => ({
        keymap: {
            editor: {
                general: {
                    copyBlockRef: {custom: "Ref"},
                    copyBlockEmbed: {custom: "Embed"},
                    copyProtocol: {custom: "Protocol"},
                    copyProtocolInMd: {custom: "ProtocolMd"},
                    copyHPath: {custom: "HPath"},
                    copyID: {custom: "ID"},
                },
            },
        },
    }),
    isElectron: false,
    siyuanI18n: {
        copyBlockRef: "Block ref",
        copyBlockEmbed: "Block embed",
        copyProtocol: "Protocol",
        copyProtocolInMd: "Protocol Markdown",
        copyWebURL: "Web URL",
        copyHPath: "Hierarchy path",
        copyID: "ID",
        copyMarkdown: "Markdown",
    },
    writeText: mocks.writeText,
}));

import {copySubMenu} from "../../src/menus/commonMenuItem/copy/copySubMenu.factory";

const click = async (item: IMenu | undefined) => {
    if (!item?.click) {
        throw new Error("Expected copy menu click action");
    }
    await item.click(document.createElement("button"), new MouseEvent("click"));
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("common copy menu", () => {
    it("preserves browser item order and accelerator values", () => {
        const items = copySubMenu(["block-id"], false, undefined, "document-id");

        expect(items.map(item => item.id)).toEqual([
            "copyBlockRef",
            "copyBlockEmbed",
            "copyProtocol",
            "copyProtocolInMd",
            "copyWebURL",
            "copyHPath",
            "copyID",
            "copyMarkdown",
        ]);
        expect(items.map(item => item.accelerator)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    });

    it("forwards the selected copy type and restores block focus", async () => {
        const focusElement = document.createElement("div");
        const items = copySubMenu(["first", "second"], true, focusElement);

        await click(items[4]);
        expect(mocks.copyTextByType).toHaveBeenCalledWith(["first", "second"], "webURL");
        expect(mocks.focusBlock).toHaveBeenCalledWith(focusElement);
    });

    it("keeps the standard Markdown request and completion order", async () => {
        const focusElement = document.createElement("div");
        const item = copySubMenu(["block-id"], true, focusElement, "document-id").at(-1);

        await click(item);
        expect(mocks.fetchSyncPost).toHaveBeenCalledWith("/api/export/exportMdContent", {
            id: "document-id",
            refMode: 3,
            embedMode: 1,
            yfm: false,
            fillCSSVar: false,
            adjustHeadingLevel: false,
        });
        expect(mocks.writeText).toHaveBeenCalledWith("# Markdown");
        expect(mocks.focusBlock).toHaveBeenCalledWith(focusElement);
        const writeOrder = mocks.writeText.mock.invocationCallOrder[0];
        const focusOrder = mocks.focusBlock.mock.invocationCallOrder[0];
        if (writeOrder === undefined || focusOrder === undefined) {
            throw new Error("Expected Markdown write and focus restoration calls");
        }
        expect(writeOrder).toBeLessThan(focusOrder);
    });
});
