import {beforeEach, describe, expect, it} from "vitest";

import {
    isSiYuanUriProtocol,
    parseSiYuanUriInfo,
    parseUriInfo,
} from "../../../src/util/uri/protocol";

const blockID = "20240101010101-abcdefg";

beforeEach(() => {
    window.history.replaceState(null, "", "/");
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {editorIsFullscreen: false},
    });
    Object.defineProperty(window, "JSAndroid", {
        configurable: true,
        value: undefined,
    });
});

describe("SiYuan URI protocol owner", () => {
    it("recognizes both supported protocols and rejects unrelated or malformed values", () => {
        expect(isSiYuanUriProtocol(`siyuan://blocks/${blockID}`)).toBe(true);
        expect(isSiYuanUriProtocol(`web+siyuan://blocks/${blockID}`)).toBe(true);
        expect(isSiYuanUriProtocol("https://example.com")).toBe(false);
        expect(isSiYuanUriProtocol("not a uri")).toBe(false);
        expect(isSiYuanUriProtocol(null)).toBe(false);
    });

    it("parses block display and AV location parameters", () => {
        const result = parseSiYuanUriInfo(
            `siyuan://blocks/${blockID}?focus=1&fullscreen=1&avItemID=20240202020202-bbbbbbb&avViewID=20240303030303-ccccccc&avGroupID=20240404040404-ddddddd`,
        );

        expect(result).toEqual({
            id: blockID,
            focus: true,
            fullscreen: true,
            avItemID: "20240202020202-bbbbbbb",
            avViewID: "20240303030303-ccccccc",
            avGroupID: "20240404040404-ddddddd",
        });
    });

    it("rejects malformed AV identifiers instead of returning partial location data", () => {
        expect(parseSiYuanUriInfo(`siyuan://blocks/${blockID}?avItemID=invalid`)).toBeNull();
        expect(parseSiYuanUriInfo(`siyuan://plugins/${blockID}`)).toBeNull();
    });

    it("reads the embedded host URL and applies fullscreen state", () => {
        const embedded = encodeURIComponent(`siyuan://blocks/${blockID}?focus=1&fullscreen=1`);
        window.history.replaceState(null, "", `/?url=${embedded}`);

        expect(parseUriInfo()).toEqual({
            id: blockID,
            focus: true,
            fullscreen: true,
        });
        expect(window.siyuan.editorIsFullscreen).toBe(true);
    });

    it("reads the Android host URI when no embedded URL is present", () => {
        Object.defineProperty(window, "JSAndroid", {
            configurable: true,
            value: {getBlockURL: () => `siyuan://blocks/${blockID}?focus=1`},
        });

        expect(parseUriInfo()).toEqual({
            id: blockID,
            focus: true,
            fullscreen: false,
        });
        expect(window.siyuan.editorIsFullscreen).toBe(false);
    });

    it("falls back to ordinary query parameters and applies fullscreen state", () => {
        window.history.replaceState(null, "", `/?id=${blockID}&focus=1&fullscreen=1`);

        expect(parseUriInfo()).toEqual({
            id: blockID,
            focus: true,
            fullscreen: true,
        });
        expect(window.siyuan.editorIsFullscreen).toBe(true);
    });
});
