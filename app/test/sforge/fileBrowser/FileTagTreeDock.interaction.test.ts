import {afterEach, describe, expect, it, vi} from "vitest";
import {createApp, type App as VueApp} from "vue";
import FileTagTreeDock from "../../../src/sforge/fileBrowser/FileTagTreeDock.vue";

let app: VueApp<Element> | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = undefined;
    host = undefined;
});

describe("FileTagTreeDock", () => {
    it("keeps tag navigation outside the file tree and opens the shared gallery tab", async () => {
        const openTab = vi.fn(async () => undefined);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileTagTreeDock, {
            app: {openTab},
            countRepository: {list: vi.fn().mockResolvedValue([{name: "blue", count: 2}])},
            definitionsRepository: {get: vi.fn().mockResolvedValue({revision: "1", items: []})},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("blue"));
        host.querySelector<HTMLElement>("[role='treeitem']")?.click();
        expect(openTab).toHaveBeenCalledWith({
            custom: {
                title: "标签: blue", icon: "iconTags", id: "sforge-file-gallery",
                data: {
                    rootID: "workspace", path: "", name: "标签: blue", scope: "global",
                    query: {allRoots: true, tags: ["blue"], matchAllTags: true, orderBy: "updated"},
                },
            },
        });
    });
});
