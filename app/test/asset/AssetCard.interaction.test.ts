import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, nextTick, type App as VueApp} from "vue";
import AssetCard from "../../src/asset/components/AssetCard.vue";

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
});

describe("AssetCard image adaptation", () => {
    it("treats the image extensions supported by the application as thumbnail surfaces", async () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(AssetCard, {
            item: {
                hName: "camera.avif",
                path: "nested/camera.avif",
                thumbnailUrl: "/api/s-forge/file-browser/thumbnail?rootID=workspace&path=nested%2Fcamera.avif&size=360",
            },
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.querySelector(".asset-card__image img")).not.toBeNull());
        expect(host?.querySelector(".asset-card__icon")).toBeNull();
    });

    it("keeps the thumbnail source isolated and reports thumbnail failures", async () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(AssetCard, {
            item: {
                hName: "page-2.png",
                path: "nested/page-2.png",
                thumbnailUrl: "/api/s-forge/file-browser/thumbnail?rootID=workspace&path=nested%2Fpage-2.png&size=360",
            },
        });
        app.mount(host);

        const image = host.querySelector<HTMLImageElement>(".asset-card__image img");
        expect(image?.src).toBe(
            `${window.location.origin}/api/s-forge/file-browser/thumbnail?rootID=workspace&path=nested%2Fpage-2.png&size=360`,
        );
        const thumbnailSource = image?.src;
        image?.dispatchEvent(new Event("error"));
        await nextTick();

        expect(image?.src).toBe(thumbnailSource);
        expect(host.querySelector<HTMLImageElement>(".asset-card__image img")).toBeNull();
        expect(host.querySelector<HTMLElement>(".asset-card__image-error")?.textContent)
            .toContain("缩略图加载失败");
    });

    it("does not invent a thumbnail source when the contract omits it", async () => {
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(AssetCard, {
            item: {
                hName: "missing.png",
                path: "nested/missing.png",
            } as unknown as {hName: string; path: string; thumbnailUrl: string},
        });
        app.mount(host);

        await nextTick();
        expect(host.querySelector<HTMLImageElement>(".asset-card__image img")).toBeNull();
        expect(host.querySelector<HTMLElement>(".asset-card__image-error")?.textContent)
            .toContain("缩略图地址为空");
        expect(host.querySelector(".asset-card__image-error")?.textContent)
            .not.toContain("/api/s-forge/thumbnail");
    });
});
