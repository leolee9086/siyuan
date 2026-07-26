import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    getSiyuanEditorGeneralKeymap: vi.fn(),
    ipcSend: vi.fn(),
    matchHotKey: vi.fn(),
}));

vi.mock("../../src/protyle/undo/keyboard/imports", () => ({
    Constants: {SIYUAN_CMD: "siyuan-cmd"},
    getSiyuanEditorGeneralKeymap: mocks.getSiyuanEditorGeneralKeymap,
    ipcSend: mocks.ipcSend,
    isElectron: true,
    matchHotKey: mocks.matchHotKey,
}));

import {electronUndo} from "../../src/protyle/undo/keyboard/electronUndo";

const createEvent = () => ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
}) as unknown as KeyboardEvent;

describe("Electron undo keyboard adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getSiyuanEditorGeneralKeymap.mockReturnValue({
            undo: {custom: "undo-key"},
            redo: {custom: "redo-key"},
        });
    });

    it.each([
        ["undo-key", "undo"],
        ["redo-key", "redo"],
    ] as const)("dispatches %s through the Electron command channel", (matchedKey, command) => {
        const event = createEvent();
        mocks.matchHotKey.mockImplementation((hotkey: string) => hotkey === matchedKey);

        expect(electronUndo(event)).toBe(true);

        expect(mocks.ipcSend).toHaveBeenCalledWith("siyuan-cmd", command);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
    });

    it("leaves unmatched keys untouched", () => {
        const event = createEvent();
        mocks.matchHotKey.mockReturnValue(false);

        expect(electronUndo(event)).toBe(false);

        expect(mocks.ipcSend).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });
});
