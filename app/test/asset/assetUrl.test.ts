import {afterEach, describe, expect, it} from "vitest";
import {resolveAssetURL} from "../../src/asset/assetUrl";

describe("resolveAssetURL", () => {
    afterEach(() => {
        document.getElementById("baseURL")?.remove();
    });

    it("keeps file and remote URLs intact", () => {
        expect(resolveAssetURL("file:///D:/assets/page.png")).toBe("file:///D:/assets/page.png");
        expect(resolveAssetURL("https://example.test/page.png")).toBe("https://example.test/page.png");
    });

    it("keeps file-browser root URLs at the application origin", () => {
        expect(resolveAssetURL("/api/s-forge/file-browser/content/root/nested/page-2.png"))
            .toBe(`${window.location.origin}/api/s-forge/file-browser/content/root/nested/page-2.png`);
    });

    it("resolves legacy relative assets against baseURL", () => {
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = "/stage/build/desktop/";
        document.head.append(base);
        expect(resolveAssetURL("assets/page-2.png")).toBe(`${window.location.origin}/stage/build/desktop/assets/page-2.png`);
        expect(resolveAssetURL("/api/s-forge/file-browser/content/workspace/page-2.png"))
            .toBe(`${window.location.origin}/api/s-forge/file-browser/content/workspace/page-2.png`);
    });

    it("keeps API URLs at the origin when baseURL is an absolute build path", () => {
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = `${window.location.origin}/stage/build/desktop/`;
        document.head.append(base);

        expect(resolveAssetURL("/api/s-forge/file-browser/content/workspace/guide%20render/page-2.png"))
            .toBe(`${window.location.origin}/api/s-forge/file-browser/content/workspace/guide%20render/page-2.png`);
        expect(resolveAssetURL("/api/s-forge/file-browser/thumbnail?rootID=workspace&path=guide%2Frender%2Fpage-2.png&size=360"))
            .toBe(`${window.location.origin}/api/s-forge/file-browser/thumbnail?rootID=workspace&path=guide%2Frender%2Fpage-2.png&size=360`);
    });

    it("repairs file-browser URLs persisted by the old desktop bundle", () => {
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = "/stage/build/desktop/";
        document.head.append(base);

        const endpoint = "/api/s-forge/file-browser/content/workspace/guide%20render/page-2.png";
        expect(resolveAssetURL("api/s-forge/file-browser/content/workspace/guide%20render/page-2.png"))
            .toBe(`${window.location.origin}${endpoint}`);
        expect(resolveAssetURL(`/stage/build/desktop${endpoint}`))
            .toBe(`${window.location.origin}${endpoint}`);
        expect(resolveAssetURL(`${window.location.origin}/stage/build/desktop${endpoint}`))
            .toBe(`${window.location.origin}${endpoint}`);
        expect(resolveAssetURL(`https://cdn.example.test/stage/build/desktop${endpoint}`))
            .toBe(`https://cdn.example.test/stage/build/desktop${endpoint}`);
    });

    it("does not treat Windows drive letters as URL schemes", () => {
        expect(resolveAssetURL("D:\\dev\\guide render\\page-2.png"))
            .toBe("file:///D:/dev/guide%20render/page-2.png");
        expect(resolveAssetURL("\\\\server\\share\\page-2.png"))
            .toBe("file://server/share/page-2.png");
        expect(resolveAssetURL("\\\\?\\D:\\dev\\page-2.png"))
            .toBe("file:///D:/dev/page-2.png");
    });

    it("fails explicitly for an empty resource address", () => {
        expect(() => resolveAssetURL(" ")).toThrow("资源地址为空");
    });

});
