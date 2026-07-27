import {beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";

const services = vi.hoisted(() => ({
    fetchSyncPost: vi.fn(),
    load: vi.fn(),
    unload: vi.fn(),
    markDocument: vi.fn(),
}));

vi.mock("../../src/inNotePlugin/manager/imports", () => ({
    fetchSyncPost: services.fetchSyncPost,
    加载笔记内插件: services.load,
    卸载笔记内插件: services.unload,
    设置为插件文档: services.markDocument,
}));

import {InNotePluginManager} from "../../src/inNotePlugin/manager/InNotePluginManager";

const runningState = (docId: string, displayName: string) => ({
    config: {
        docId,
        name: `in-note-${docId}`,
        displayName,
        enabled: true,
        lastLoadAt: 0,
        lastError: null,
    },
    instance: null,
    status: "running" as const,
});

describe("InNotePluginManager", () => {
    beforeEach(() => {
        localStorage.clear();
        services.fetchSyncPost.mockReset();
        services.load.mockReset();
        services.unload.mockReset();
        services.markDocument.mockReset();
        services.load.mockImplementation(async (_app, config) => runningState(config.docId, config.displayName));
    });

    it("keeps plugin state isolated between manager instances", async () => {
        const first = new InNotePluginManager();
        const second = new InNotePluginManager();
        await first.init(createTestAppFacade());
        await second.init(createTestAppFacade());

        await first.启用插件("doc-a", "Plugin A");

        expect(first.是否已启用("doc-a")).toBe(true);
        expect(second.是否已启用("doc-a")).toBe(false);
    });

    it("restores persisted plugins and removes missing documents", async () => {
        localStorage.setItem("in-note-plugins", JSON.stringify(["doc-a", "missing"]));
        services.fetchSyncPost.mockImplementation(async (_url, data) => ({
            code: 0,
            data: data.id === "doc-a" ? {rootTitle: "Plugin A"} : null,
        }));
        const manager = new InNotePluginManager();

        await manager.init(createTestAppFacade());

        expect(manager.是否已启用("doc-a")).toBe(true);
        expect(manager.是否已启用("missing")).toBe(false);
        expect(JSON.parse(localStorage.getItem("in-note-plugins") ?? "[]")).toEqual(["doc-a"]);
    });

    it("preserves disable, reload and document-marking lifecycle delegation", async () => {
        const manager = new InNotePluginManager();
        await manager.init(createTestAppFacade());
        await manager.启用插件("doc-a", "Plugin A");
        services.markDocument.mockResolvedValue(true);

        expect(await manager.设置为插件文档("doc-a")).toBe(true);
        expect(await manager.重载插件("doc-a")).toBe(true);
        await manager.禁用插件("doc-a");

        expect(services.markDocument).toHaveBeenCalledWith("doc-a");
        expect(services.unload).toHaveBeenCalledTimes(2);
        expect(manager.是否已启用("doc-a")).toBe(false);
        expect(JSON.parse(localStorage.getItem("in-note-plugins") ?? "[]")).toEqual([]);
    });
});
