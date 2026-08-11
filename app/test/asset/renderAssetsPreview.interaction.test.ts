import {afterEach, describe, expect, it, vi} from "vitest";
import {renderAssetsPreview} from "../../src/asset/renderAssets";
import {isAssetThumbnail} from "../../src/asset/assetFormat";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("renderAssetsPreview image source contract", () => {
    it("reports a thumbnail failure instead of leaving a broken image", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("metadata unavailable")));
        const host = document.createElement("div");
        document.body.append(host);
        try {
            host.innerHTML = renderAssetsPreview("assets/page-2.png");
            const image = host.querySelector<HTMLImageElement>("img[data-sforge-preview-image='thumbnail']");
            expect(image).not.toBeNull();

            image?.dispatchEvent(new Event("error"));
            expect(host.querySelector("img")).toBeNull();
            expect(host.querySelector<HTMLElement>("[role='alert']")?.textContent)
                .toContain("缩略图加载失败");
        } finally {
            host.remove();
        }
    });

    it("uses the shared asset format strategy for extended media and text formats", () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("metadata unavailable")));
        const cases = [
            {path: "assets/photo.HEIC", selector: "img[data-sforge-preview-image='thumbnail']"},
            {path: "assets/recording.OPUS", selector: "audio"},
            {path: "assets/clip.3GP", selector: "video"},
            {path: "notes/component.TSX", selector: ".fn__flex-column"},
        ];
        for (const testCase of cases) {
            const host = document.createElement("div");
            document.body.append(host);
            try {
                host.innerHTML = renderAssetsPreview(testCase.path);
                expect(host.querySelector(testCase.selector), testCase.path).not.toBeNull();
            } finally {
                host.remove();
            }
        }
    });

    it("marks reference-specific .sy and .d5m formats as generated thumbnails", () => {
        expect(isAssetThumbnail("notes/archive.SY")).toBe(true);
        expect(isAssetThumbnail("models/scene.D5M")).toBe(true);
        expect(isAssetThumbnail("notes/readme.md")).toBe(false);
    });

    it("routes SVG and D5M previews through the format provider thumbnail endpoint", () => {
        const cases = [
            "icons/mark.svg",
            "models/scene.d5m",
            "notes/archive.sy",
        ];
        for (const path of cases) {
            const host = document.createElement("div");
            document.body.append(host);
            try {
                host.innerHTML = renderAssetsPreview(path);
                const image = host.querySelector<HTMLImageElement>("img[data-sforge-preview-image='thumbnail']");
                expect(image, path).not.toBeNull();
                expect(image?.src, path).toContain(`/api/s-forge/thumbnail?path=${encodeURIComponent(path)}`);
            } finally {
                host.remove();
            }
        }
    });
});
