import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    storage: {
        searchKeys: {keys: ["old"], replaceKeys: ["replace-old"]},
        searchAsset: {k: "", keys: ["asset-old"]},
    },
    setStorageVal: vi.fn(),
}));

vi.mock("../../src/search/history/imports", () => ({
    Constants: {
        LOCAL_SEARCHASSET: "searchAsset",
        LOCAL_SEARCHKEYS: "searchKeys",
    },
    getSiyuanConfig: () => ({search: {limit: 2}}),
    getSiyuanStorage: () => runtime.storage,
    setStorageVal: runtime.setStorageVal,
}));

import {saveAssetKeyList, saveKeyList} from "../../src/search/history/storage";

describe("search history persistence", () => {
    beforeEach(() => {
        runtime.storage.searchKeys = {keys: ["old"], replaceKeys: ["replace-old"]};
        runtime.storage.searchAsset = {k: "", keys: ["asset-old"]};
        runtime.setStorageVal.mockReset();
    });

    it("writes ordinary and replacement terms to their requested history slots", () => {
        saveKeyList("keys", "new");
        saveKeyList("replaceKeys", "replace-new");

        expect(runtime.storage.searchKeys).toEqual({
            keys: ["new", "old"],
            replaceKeys: ["replace-new", "replace-old"],
        });
        expect(runtime.setStorageVal).toHaveBeenNthCalledWith(1, "searchKeys", runtime.storage.searchKeys);
        expect(runtime.setStorageVal).toHaveBeenNthCalledWith(2, "searchKeys", runtime.storage.searchKeys);
    });

    it("writes a non-empty asset term and leaves empty input untouched", () => {
        const input = document.createElement("input");
        saveAssetKeyList(input);
        expect(runtime.setStorageVal).not.toHaveBeenCalled();

        input.value = "asset-new";
        saveAssetKeyList(input);
        expect(runtime.storage.searchAsset).toEqual({k: "asset-new", keys: ["asset-new", "asset-old"]});
        expect(runtime.setStorageVal).toHaveBeenCalledWith("searchAsset", runtime.storage.searchAsset);
    });
});
