import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileTagTreePanel from "../../../src/sforge/fileBrowser/FileTagTreePanel.vue";

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
});

describe("FileTagTreePanel", () => {
    it("renders indexed hierarchy and opens the shared gallery query", async () => {
        const openTag = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileTagTreePanel, {
            countRepository: {
                list: vi.fn().mockResolvedValue([
                    {name: "ui/icons", count: 2},
                    {name: "blue", count: 1},
                ]),
            },
            definitionsRepository: {
                get: vi.fn().mockResolvedValue({revision: "1", items: [{name: "blue", color: "#3366ff"}]}),
            },
            onOpenTag: openTag,
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("blue"));
        expect(host?.textContent).toContain("ui");
        expect(host?.textContent).not.toContain("icons");
        expect(host?.querySelector(".sforge-file-tag-tree__swatch")?.getAttribute("title")).toBe("#3366FF");

        const uiRow = Array.from(host?.querySelectorAll<HTMLElement>("[role='treeitem']") ?? [])
            .find(row => row.textContent?.includes("ui"));
        const uiToggle = uiRow?.querySelector<HTMLButtonElement>(".sforge-file-tag-tree__toggle");
        uiToggle?.click();
        await vi.waitFor(() => expect(host?.textContent).toContain("icons"));

        const blueRow = Array.from(host?.querySelectorAll<HTMLElement>("[role='treeitem']") ?? [])
            .find(row => row.textContent?.includes("blue"));
        blueRow?.click();
        expect(openTag).toHaveBeenCalledWith("blue");
    });
});
