import {beforeEach, describe, expect, it, vi} from "vitest";
import {FRONTEND_ACTION_REGISTRY} from "../../../../src/config/sforge.symbols";
import {setSForgeState} from "../../../../src/config/sforge.global";
import {
    listActions,
    lookupAction,
    registerAction,
    unregisterAction,
} from "../../../../src/layout/dock/agent/frontendActions";
import {createTestAppFacade} from "../../../app/AppFacade.fixture";

describe("frontend action registry", () => {
    beforeEach(() => {
        setSForgeState(FRONTEND_ACTION_REGISTRY, undefined);
        document.getElementById("sidebar")?.remove();
    });

    it("initializes built-ins once and lets a plugin override a built-in", () => {
        const pluginHandler = vi.fn(async () => ({result: "plugin"}));

        expect(listActions().map((action) => action.name)).toEqual([
            "open_setting",
            "focus_block",
            "open_document",
            "open_search",
        ]);
        registerAction({name: "open_setting", handler: pluginHandler});

        expect(lookupAction("open_setting")?.handler).toBe(pluginHandler);
        expect(listActions().filter((action) => action.name === "open_setting")).toHaveLength(1);
    });

    it("removes a registered plugin action from the shared registry", () => {
        registerAction({name: "plugin__sample", handler: vi.fn(async () => ({result: "ok"}))});

        unregisterAction("plugin__sample");

        expect(lookupAction("plugin__sample")).toBeUndefined();
    });

    it("queries open editors through the complete application facade", async () => {
        const app = createTestAppFacade();
        const getOpenEditors = vi.fn(() => []);
        app.getOpenEditors = getOpenEditors;

        const result = await lookupAction("focus_block")?.handler({id: "block-id"}, app);

        expect(getOpenEditors).toHaveBeenCalledOnce();
        expect(result).toEqual({
            error: "Block block-id is not loaded in any open editor. Use open_document to open it first.",
        });
    });

    it("opens documents and search through the complete application facade", async () => {
        const openBlock = vi.fn(async () => undefined);
        const app = createTestAppFacade(openBlock);
        const openSearch = vi.fn(async () => undefined);
        app.openSearch = openSearch;

        const documentResult = await lookupAction("open_document")?.handler({id: "document-id"}, app);
        const searchResult = await lookupAction("open_search")?.handler({query: "  graph  "}, app);

        expect(openBlock).toHaveBeenCalledWith({id: "document-id", action: ["cb-get-focus"]});
        expect(documentResult).toEqual({result: "Opened document document-id."});
        expect(openSearch).toHaveBeenCalledWith("graph");
        expect(searchResult).toEqual({result: 'Opened search dialog with query "graph".'});
    });
});
