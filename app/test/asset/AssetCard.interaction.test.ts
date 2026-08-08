import {afterEach, describe, expect, it} from "vitest";
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
    it("uses a stable fallback instead of exposing a broken image", async () => {
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
        image?.dispatchEvent(new Event("error"));
        await nextTick();

        expect(host.querySelector<HTMLElement>(".asset-card__image-fallback")).toBeTruthy();
        expect(host.querySelector<HTMLImageElement>(".asset-card__image img")?.src).toMatch(/^data:image\/png;base64,/);
    });
});
