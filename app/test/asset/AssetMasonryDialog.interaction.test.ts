import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";

const mocks = vi.hoisted(() => ({
    searchAssets: vi.fn(),
}));

vi.mock("../../src/data/kernelAPI/sforgeAssetMeta", () => ({
    搜索素材元数据: mocks.searchAssets,
}));

import AssetMasonryDialog from "../../src/asset/components/AssetMasonryDialog.vue";

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.clearAllMocks();
    app = undefined;
    host = undefined;
});

describe("AssetMasonryDialog search failures", () => {
    it("shows the request error instead of presenting an empty result", async () => {
        mocks.searchAssets.mockRejectedValue(new Error("索引服务不可用"));
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(AssetMasonryDialog);
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("[role='alert']")?.textContent)
            .toContain("索引服务不可用"));
        expect(host?.querySelector(".asset-masonry-dialog__empty")).toBeNull();
        expect(host?.querySelector(".asset-masonry-dialog__error button")).not.toBeNull();
    });
});
