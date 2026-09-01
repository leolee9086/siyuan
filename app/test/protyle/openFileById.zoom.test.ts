import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    activateQueuedAVLocate: vi.fn(),
    fetchSyncPost: vi.fn(),
    getAVLocateRenderer: vi.fn(),
    openFile: vi.fn(),
    setDatabaseItemNavigator: vi.fn(),
    showMessage: vi.fn(),
}));

vi.mock("../../src/editor/imports", () => ({
    Constants: {
        CB_GET_CONTEXT: "context",
        CB_GET_ROOTSCROLL: "root-scroll",
    },
    activateQueuedAVLocate: mocks.activateQueuedAVLocate,
    fetchSyncPost: mocks.fetchSyncPost,
    getAVLocateRenderer: mocks.getAVLocateRenderer,
    setDatabaseItemNavigator: mocks.setDatabaseItemNavigator,
    showMessage: mocks.showMessage,
}));

vi.mock("../../src/editor/open/openFile", () => ({
    openFile: mocks.openFile,
}));

import {openFileById} from "../../src/editor/utils.openFileById";

const mockBlockInfo = (rootID: string) => ({
    code: 0,
    data: {
        rootID,
        rootIcon: "",
        rootTitle: "Root document",
        rootTitleEmpty: false,
    },
});

const openByID = async (id: string, rootID: string) => {
    mocks.fetchSyncPost.mockResolvedValue(mockBlockInfo(rootID));
    await openFileById({
        app: undefined!,
        id,
        zoomIn: true,
    });
};

describe("openFileById zoom behavior", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("does not zoom a root document", async () => {
        await openByID("root", "root");

        expect(mocks.openFile).toHaveBeenCalledWith(expect.objectContaining({
            id: "root",
            rootID: "root",
            zoomIn: false,
        }));
    });

    it("keeps zooming an explicitly requested child block", async () => {
        await openByID("child", "root");

        expect(mocks.openFile).toHaveBeenCalledWith(expect.objectContaining({
            id: "child",
            rootID: "root",
            zoomIn: true,
        }));
    });
});
