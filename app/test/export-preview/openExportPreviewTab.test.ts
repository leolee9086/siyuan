import {describe, expect, it, vi} from "vitest";
import type {LayoutTab} from "../../src/layout/layout.types";
import {createTestAppFacade} from "../app/AppFacade.fixture";

vi.mock("../../src/export-preview/imports", () => ({
    getAllModels: () => ({custom: []}),
    siyuanI18n: {preview: "Preview"},
}));

import {openExportPreviewTab} from "../../src/export-preview/open";

describe("openExportPreviewTab", () => {
    it("waits for the app facade to finish opening a new preview tab", async () => {
        const app = createTestAppFacade();
        let finishOpen: ((tab: LayoutTab | undefined) => void) | undefined;
        const openTab = vi.spyOn(app, "openTab").mockImplementation(() => new Promise((resolve) => {
            finishOpen = resolve;
        }));

        let finished = false;
        const opening = openExportPreviewTab({
            app,
            blockId: "document-id",
            previewType: "image",
        }).then(() => {
            finished = true;
        });

        await Promise.resolve();
        expect(finished).toBe(false);
        expect(openTab).toHaveBeenCalledWith({
            custom: {
                title: "Preview",
                icon: "iconPreview",
                id: "export-preview",
                data: {
                    blockId: "document-id",
                    previewType: "image",
                },
            },
        });

        if (!finishOpen) {
            throw new Error("AppFacade.openTab was not called");
        }
        finishOpen(undefined);
        await opening;
        expect(finished).toBe(true);
    });
});
