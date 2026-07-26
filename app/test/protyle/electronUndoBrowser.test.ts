import {expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    getSiyuanEditorGeneralKeymap: vi.fn(),
    ipcSend: vi.fn(),
    matchHotKey: vi.fn(),
}));

vi.mock("../../src/protyle/undo/keyboard/imports", () => ({
    Constants: {SIYUAN_CMD: "siyuan-cmd"},
    getSiyuanEditorGeneralKeymap: mocks.getSiyuanEditorGeneralKeymap,
    ipcSend: mocks.ipcSend,
    isElectron: false,
    matchHotKey: mocks.matchHotKey,
}));

import {electronUndo} from "../../src/protyle/undo/keyboard/electronUndo";

it("short-circuits browser input before reading the editor keymap", () => {
    expect(electronUndo(new KeyboardEvent("keydown"))).toBe(false);
    expect(mocks.getSiyuanEditorGeneralKeymap).not.toHaveBeenCalled();
    expect(mocks.matchHotKey).not.toHaveBeenCalled();
    expect(mocks.ipcSend).not.toHaveBeenCalled();
});
