import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    fetchPost: vi.fn(),
    saveScroll: vi.fn(async () => undefined),
}));

vi.mock("../../src/layout/export/imports", () => ({
    fetchPost: runtime.fetchPost,
    isWindow: () => false,
    saveScroll: runtime.saveScroll,
    getAllEditor: () => [],
    getSiyuanConfig: () => ({readonly: false}),
    getSiyuanLayout: () => undefined,
    buildMainWindowLayoutJSON: () => ({layout: {}}),
    serializeWindowModeLayout: vi.fn(),
    layoutToJSON: vi.fn(),
}));

import {exportLayout} from "../../src/layout/export/exportLayout";

describe("exportLayout persistence lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not resolve before layout persistence completes", async () => {
        let completePersistence: (() => void) | undefined;
        runtime.fetchPost.mockImplementation(() => new Promise<void>((resolve) => {
            completePersistence = resolve;
        }));
        let completed = false;
        const exporting = exportLayout({cb: vi.fn(), errorExit: false}).then(() => {
            completed = true;
        });

        await Promise.resolve();
        expect(completed).toBe(false);
        expect(runtime.fetchPost).toHaveBeenCalledWith(
            "/api/system/setUILayout",
            {layout: {layout: {}}, errorExit: false},
            expect.any(Function),
        );

        completePersistence?.();
        await exporting;
        expect(completed).toBe(true);
    });

    it("propagates layout persistence failures", async () => {
        const error = new Error("layout persistence failed");
        const callback = vi.fn();
        runtime.fetchPost.mockRejectedValue(error);

        await expect(exportLayout({cb: callback, errorExit: false})).rejects.toBe(error);
        expect(callback).not.toHaveBeenCalled();
    });
});
