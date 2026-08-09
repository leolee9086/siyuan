import {afterEach, describe, expect, it, vi} from "vitest";
import {renderAssetsPreview} from "../../src/asset/renderAssets";

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
});
