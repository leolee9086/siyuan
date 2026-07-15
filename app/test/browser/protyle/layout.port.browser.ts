import {afterEach, describe, expect, it, vi} from "vitest";
import {
    clearProtyleBeforeResizeTop,
    clearProtylePanelFocus,
    findProtyleBlockCopies,
    focusProtylePanel,
    recordProtyleBeforeResizeTop,
    refreshProtyleBacklink,
    refreshProtyleOutline,
    removeProtyleTab,
    removeProtyleBacklinkEditor,
    resetProtyleLayoutPort,
    setProtyleLayoutPort,
    setProtyleOutlineCurrent,
    updateProtyleOutline,
    updateProtylePanel,
    updateProtyleTitle,
} from "../../../src/protyle/runtime/layout.port";
import type {IProtyleLayoutPort} from "../../../src/protyle/runtime/layout.types";

const protyle = {} as IProtyle;

afterEach(() => {
    resetProtyleLayoutPort();
});

describe("Protyle layout host capability", () => {
    it("uses a safe no-op when no layout host is registered", () => {
        resetProtyleLayoutPort();

        expect(() => {
            refreshProtyleOutline("root");
            updateProtyleOutline(protyle, true);
            refreshProtyleBacklink(protyle);
            updateProtylePanel(protyle, {
                focus: false,
                pushBackStack: false,
                reload: false,
                resize: false,
            });
            expect(focusProtylePanel(protyle)).toEqual({handled: false, needsUpdate: false});
            clearProtylePanelFocus();
            updateProtyleTitle(protyle, "", true);
            removeProtyleTab(protyle);
            recordProtyleBeforeResizeTop();
            clearProtyleBeforeResizeTop();
            expect(findProtyleBlockCopies("block")).toEqual([]);
            setProtyleOutlineCurrent(protyle, document.createElement("div"));
            removeProtyleBacklinkEditor(protyle, document.createElement("div"));
        }).not.toThrow();
    });

    it("forwards layout coordination to the registered host", () => {
        const host: IProtyleLayoutPort = {
            refreshOutline: vi.fn(),
            updateOutline: vi.fn(),
            setOutlineCurrent: vi.fn(),
            refreshBacklink: vi.fn(),
            updatePanel: vi.fn(),
            focus: vi.fn(() => ({handled: true, needsUpdate: true})),
            clearFocus: vi.fn(),
            updateTitle: vi.fn(),
            removeTab: vi.fn(),
            recordBeforeResizeTop: vi.fn(),
            clearBeforeResizeTop: vi.fn(),
            findBlockCopies: vi.fn(() => [document.createElement("div")]),
            removeBacklinkEditor: vi.fn(),
        };
        const options = {focus: true, pushBackStack: true, reload: true, resize: true};

        setProtyleLayoutPort(host);
        refreshProtyleOutline("root");
        updateProtyleOutline(protyle, true);
        refreshProtyleBacklink(protyle);
        updateProtylePanel(protyle, options);
        expect(focusProtylePanel(protyle)).toEqual({handled: true, needsUpdate: true});
        clearProtylePanelFocus();
        updateProtyleTitle(protyle, "Title", false);
        removeProtyleTab(protyle);
        recordProtyleBeforeResizeTop();
        clearProtyleBeforeResizeTop();
        expect(findProtyleBlockCopies("block")).toHaveLength(1);
        setProtyleOutlineCurrent(protyle, document.createElement("div"), true);

        expect(host.refreshOutline).toHaveBeenCalledWith("root");
        expect(host.updateOutline).toHaveBeenCalledWith(protyle, true);
        expect(host.refreshBacklink).toHaveBeenCalledWith(protyle);
        expect(host.updatePanel).toHaveBeenCalledWith(protyle, options);
        expect(host.clearFocus).toHaveBeenCalledOnce();
        expect(host.updateTitle).toHaveBeenCalledWith(protyle, "Title", false);
        expect(host.removeTab).toHaveBeenCalledWith(protyle);
        expect(host.recordBeforeResizeTop).toHaveBeenCalledOnce();
        expect(host.clearBeforeResizeTop).toHaveBeenCalledOnce();
        expect(host.findBlockCopies).toHaveBeenCalledWith("block");
        expect(host.setOutlineCurrent).toHaveBeenCalledWith(expect.anything(), expect.any(Element), true);
        removeProtyleBacklinkEditor(protyle, document.createElement("div"));
        expect(host.removeBacklinkEditor).toHaveBeenCalledWith(protyle, expect.any(Element));
    });
});
