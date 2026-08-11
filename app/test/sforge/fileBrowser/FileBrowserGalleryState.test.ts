import {describe, expect, it} from "vitest";
import {
    appendFileBrowserGalleryPage,
    applyFileBrowserGalleryInitialPage,
    createFileBrowserGalleryResult,
    deriveFileBrowserGalleryContentState,
    deriveFileBrowserGalleryDisplayState,
} from "../../../src/sforge/fileBrowser/FileBrowserGalleryState";
import type {FileBrowserSearchResult} from "../../../src/sforge/fileBrowser/FileBrowser.query.types";

const asset = (path: string) => ({
    rootID: "workspace", path, name: path.split("/").at(-1) ?? path, tags: [], star: 0,
    annotation: "", boundBlockId: "", source: "", sourceId: "", importTime: 0,
    width: 0, height: 0, fileSize: 1,
});

const key = (item: {rootID: string; path: string}) => `${item.rootID}:${item.path}`;

describe("FileBrowserGalleryState", () => {
    it("derives ready from assets even when a stale phase says empty", () => {
        const state = {...createFileBrowserGalleryResult("empty"), assets: [{...asset("a.png"), key: "a"}]};
        expect(deriveFileBrowserGalleryDisplayState(state, false, "")).toBe("ready");
        const content = deriveFileBrowserGalleryContentState(state, false, "");
        expect(content.kind).toBe("ready");
        expect(content.assets).toHaveLength(1);
    });

    it("keeps loaded assets when an empty pagination page arrives", () => {
        const initial: FileBrowserSearchResult = {assets: [asset("a.png")], totalCount: 2, pageCount: 1};
        const state = applyFileBrowserGalleryInitialPage(initial, {limit: 1, offset: 0}, 1, key);
        const next = appendFileBrowserGalleryPage(state, {assets: [], totalCount: 2, pageCount: 0}, 1, key);
        expect(next.assets.map(item => item.path)).toEqual(["a.png"]);
        expect(next.phase).toBe("ready");
        expect(deriveFileBrowserGalleryDisplayState(next, false, "")).toBe("ready");
    });

    it("returns an empty display state only for a completed zero-result query", () => {
        const state = applyFileBrowserGalleryInitialPage(
            {assets: [], totalCount: 0, pageCount: 0},
            {limit: 200, offset: 0},
            200,
            key,
        );
        expect(state.phase).toBe("empty");
        expect(deriveFileBrowserGalleryDisplayState(state, false, "")).toBe("empty");
        expect(deriveFileBrowserGalleryContentState(state, false, "")).toEqual({kind: "empty", assets: []});
    });

    it("does not project stale assets while the unified result is loading", () => {
        const state = {...createFileBrowserGalleryResult("ready"), assets: [{...asset("a.png"), key: "a"}]};
        expect(deriveFileBrowserGalleryContentState(state, true, "")).toEqual({kind: "loading", assets: []});
    });
});
