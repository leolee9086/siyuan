import {beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted((): {storage: Record<string, unknown> | undefined} => ({
    storage: undefined,
}));

vi.mock("../../src/protyle/export/image/imports", () => ({
    Constants: {LOCAL_EXPORTIMG: "local-exportimg"},
    getSafeSiyuanStorage: () => state.storage,
}));

import {getExportImageStorage} from "../../src/protyle/export/image/exportImage.storage";

beforeEach(() => {
    state.storage = undefined;
});

describe("export image storage", () => {
    it("keeps the default configuration when the Siyuan storage is absent", async () => {
        await expect(getExportImageStorage()).resolves.toEqual({
            keepFold: false,
            watermark: false,
            ratio: "auto",
            background: "",
        });
    });

    it("normalizes historical values and writes them back to the same storage", async () => {
        const storage: Record<string, unknown> = {
            "local-exportimg": {
                keepFold: "true",
                watermark: 0,
                ratio: "16/9",
                background: "url(asset.png)",
            },
        };
        state.storage = storage;

        const normalized = await getExportImageStorage();
        expect(normalized).toEqual({
            keepFold: true,
            watermark: false,
            ratio: "16/9",
            background: "url(asset.png)",
        });
        expect(storage["local-exportimg"]).toBe(normalized);
    });
});
