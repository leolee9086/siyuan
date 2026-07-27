import {beforeEach, describe, expect, it, vi} from "vitest";

const resizeSpies = vi.hoisted(() => ({
    getAllModels: vi.fn(),
    hideAllElements: vi.fn(),
    hideElements: vi.fn(),
    pdfResize: vi.fn(),
    saveLayout: vi.fn(),
}));
const resizeState = vi.hoisted<{current: {timeout?: number} | undefined}>(() => ({current: undefined}));

vi.mock("../../../src/layout/resize/imports", () => ({
    LAYOUT_RESIZE_REGISTRY: Symbol.for("sforge.layout.resizeRegistry"),
    getAllModels: resizeSpies.getAllModels,
    getSForgeState: vi.fn(() => resizeState.current),
    hideAllElements: resizeSpies.hideAllElements,
    hideElements: resizeSpies.hideElements,
    pdfResize: resizeSpies.pdfResize,
    saveLayout: resizeSpies.saveLayout,
    setSForgeState: vi.fn((_key: symbol, value: {timeout?: number} | undefined) => {
        resizeState.current = value;
    }),
}));

const emptyModels = () => ({
    editor: [],
    backlink: [],
    search: [],
    custom: [],
});

describe("resizeTabs", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        vi.clearAllMocks();
        resizeSpies.getAllModels.mockReturnValue(emptyModels());
        resizeState.current = undefined;
    });

    it("executes only the final scheduled resize and preserves save intent", async () => {
        const {resizeTabs} = await import("../../../src/layout/resize/resizeTabs");

        resizeTabs(true);
        resizeTabs(false);

        vi.advanceTimersByTime(199);
        expect(resizeSpies.getAllModels).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(resizeSpies.getAllModels).toHaveBeenCalledOnce();
        expect(resizeSpies.saveLayout).not.toHaveBeenCalled();
    });

    it("resizes each supported model and finishes in the original cleanup order", async () => {
        const editorResize = vi.fn();
        const backlinkResize = vi.fn();
        const customResize = vi.fn();
        const searchResize = vi.fn();
        const treeElement = {
            previousElementSibling: {clientHeight: 10},
            style: {height: "20px"},
        };
        const editor = {
            editor: {protyle: {}, resize: editorResize},
            element: {classList: {contains: vi.fn(() => false)}, parentElement: {}},
        };
        const backlinkEditor = {protyle: {}, resize: backlinkResize};
        const backlink = {
            element: {
                clientHeight: 100,
                querySelector: vi.fn(() => treeElement),
            },
            editors: [backlinkEditor],
        };
        const search = {
            element: {querySelector: vi.fn(() => ({classList: {contains: vi.fn(() => true)}}))},
            editors: {edit: {resize: searchResize}, unRefEdit: {resize: vi.fn()}},
        };
        resizeSpies.getAllModels.mockReturnValue({
            ...emptyModels(),
            editor: [editor],
            backlink: [backlink],
            search: [search],
            custom: [{resize: customResize}],
        });
        const {resizeTabs} = await import("../../../src/layout/resize/resizeTabs");

        resizeTabs();
        vi.advanceTimersByTime(200);

        expect(editorResize).toHaveBeenCalledOnce();
        expect(backlinkResize).toHaveBeenCalledOnce();
        expect(customResize).toHaveBeenCalledOnce();
        expect(searchResize).toHaveBeenCalledOnce();
        expect(resizeSpies.hideElements).toHaveBeenCalledWith(["gutter"], backlinkEditor.protyle);
        expect(resizeSpies.pdfResize).toHaveBeenCalledOnce();
        expect(resizeSpies.hideAllElements).toHaveBeenCalledWith(["gutter"]);
        expect(resizeSpies.saveLayout).toHaveBeenCalledOnce();
        const customCall = customResize.mock.invocationCallOrder[0];
        const pdfCall = resizeSpies.pdfResize.mock.invocationCallOrder[0];
        const hideAllCall = resizeSpies.hideAllElements.mock.invocationCallOrder[0];
        const saveCall = resizeSpies.saveLayout.mock.invocationCallOrder[0];
        expect(customCall).toBeDefined();
        expect(pdfCall).toBeDefined();
        expect(hideAllCall).toBeDefined();
        expect(saveCall).toBeDefined();
        if (customCall !== undefined && pdfCall !== undefined && hideAllCall !== undefined && saveCall !== undefined) {
            expect(pdfCall).toBeGreaterThan(customCall);
            expect(hideAllCall).toBeGreaterThan(pdfCall);
            expect(saveCall).toBeGreaterThan(hideAllCall);
        }
        expect(treeElement.style.height).toBe("80px");
    });
});
