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

    it("opens note search on Ctrl click and writes an authorized dropped file", async () => {
        const openNotes = vi.fn();
        const add = vi.fn().mockResolvedValue(undefined);
        const on = vi.fn();
        const off = vi.fn();
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileTagTreePanel, {
            countRepository: {list: vi.fn().mockResolvedValue([{name: "blue", count: 1}])},
            definitionsRepository: {get: vi.fn().mockResolvedValue({revision: "1", items: []})},
            mutationRepository: {add},
            eventBus: {on, off},
            onOpenNotes: openNotes,
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("blue"));
        const row = host.querySelector<HTMLElement>("[role='treeitem']");
        row?.dispatchEvent(new MouseEvent("click", {bubbles: true, ctrlKey: true}));
        expect(openNotes).toHaveBeenCalledWith("blue");

        const dataTransfer = {
            getData: vi.fn((type: string) => type === "application/x-sforge-file" ? JSON.stringify({
                rootID: "agent-a", path: "output/blue.png", kind: "file", name: "blue.png",
            }) : ""),
        };
        const drop = new Event("drop", {bubbles: true, cancelable: true});
        Object.defineProperty(drop, "dataTransfer", {value: dataTransfer});
        row?.dispatchEvent(drop);
        await vi.waitFor(() => expect(add).toHaveBeenCalledWith([
            {rootID: "agent-a", path: "output/blue.png"},
        ], "blue"));
        expect(on).toHaveBeenCalledWith("ws-main", expect.any(Function));
    });

    it("writes every authorized file in a multi-selection drop", async () => {
        const add = vi.fn().mockResolvedValue(undefined);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileTagTreePanel, {
            countRepository: {list: vi.fn().mockResolvedValue([{name: "blue", count: 1}])},
            definitionsRepository: {get: vi.fn().mockResolvedValue({revision: "1", items: []})},
            mutationRepository: {add},
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("blue"));
        const dataTransfer = {
            getData: vi.fn((type: string) => type === "application/x-sforge-file" ? JSON.stringify({
                rootID: "agent-a", path: "output/one.png", kind: "file", name: "one.png",
                items: [
                    {rootID: "agent-a", path: "output/one.png", kind: "file", name: "one.png"},
                    {rootID: "agent-a", path: "output/two.png", kind: "file", name: "two.png"},
                ],
            }) : ""),
        };
        const drop = new Event("drop", {bubbles: true, cancelable: true});
        Object.defineProperty(drop, "dataTransfer", {value: dataTransfer});
        host.querySelector<HTMLElement>("[role='treeitem']")?.dispatchEvent(drop);
        await vi.waitFor(() => expect(add).toHaveBeenCalledWith([
            {rootID: "agent-a", path: "output/one.png"},
            {rootID: "agent-a", path: "output/two.png"},
        ], "blue"));
    });

    it("deletes an unreferenced configured tag and unregisters the event listener", async () => {
        const update = vi.fn().mockResolvedValue({revision: "2", items: []});
        const on = vi.fn();
        const off = vi.fn();
        const confirmDelete = vi.fn().mockResolvedValue(true);
        host = document.createElement("div");
        document.body.append(host);
        app = createApp(FileTagTreePanel, {
            countRepository: {list: vi.fn().mockResolvedValue([])},
            definitionsRepository: {
                get: vi.fn().mockResolvedValue({revision: "1", items: [{name: "orphan", color: "#FF0000"}]}),
                update,
            },
            eventBus: {on, off},
            confirmDelete,
        });
        app.mount(host);

        await vi.waitFor(() => expect(host?.textContent).toContain("orphan"));
        host.querySelector<HTMLButtonElement>(".sforge-file-tag-tree__delete")?.click();
        await vi.waitFor(() => expect(update).toHaveBeenCalledWith({expectedRevision: "1", items: []}));
        app.unmount();
        expect(off).toHaveBeenCalledWith("ws-main", expect.any(Function));
    });
});
