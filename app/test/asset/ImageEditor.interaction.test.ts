import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import ImageEditor from "../../src/components/panels/imageEditor.vue";

vi.mock("@leolee9086/image-dehazing", () => ({
    dehazeImageWebGPUSimple: vi.fn(),
}));

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    vi.restoreAllMocks();
    document.getElementById("baseURL")?.remove();
    app = undefined;
    host = undefined;
});

describe("image editor file-browser source adaptation", () => {
    it("renders the original source directly without a loading placeholder", async () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(ImageEditor, {
            src: "/api/s-forge/file-browser/content/root-1/nested/page-2.png",
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        expect(host?.querySelector(".asset__image-loading")).toBeNull();
        expect(host?.querySelector("img")?.classList.contains("asset__image--loading")).toBe(false);

        host?.querySelector<HTMLImageElement>("img")?.dispatchEvent(new Event("load"));
        await nextTick();

        expect(host?.querySelector("img")?.getAttribute("src")).toContain(
            "/api/s-forge/file-browser/content/root-1/nested/page-2.png",
        );
    });

    it("keeps the original source after failure and reports an explicit error", async () => {
        const base = document.createElement("base");
        base.id = "baseURL";
        base.href = "/stage/build/desktop/";
        document.head.append(base);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(ImageEditor, {
            src: "/stage/build/desktop/api/s-forge/file-browser/content/root-1/nested/page-2.png",
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector("img")).not.toBeNull());
        const image = host?.querySelector<HTMLImageElement>("img");
        expect(image?.src).toBe(
            `${window.location.origin}/api/s-forge/file-browser/content/root-1/nested/page-2.png`,
        );
        const originalSource = image?.src;

        image?.dispatchEvent(new Event("error"));
        await nextTick();
        expect(image?.src).toBe(originalSource);
        expect(host?.querySelector("img")).toBeNull();
        expect(host?.querySelector(".asset__image-error")?.textContent).toContain("原图加载失败");
        expect(host?.querySelector(".asset__image-error")?.textContent).not.toContain("缩略图");
    });
});
