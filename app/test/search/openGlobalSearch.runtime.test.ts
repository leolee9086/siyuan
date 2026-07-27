import {beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";

const runtime = vi.hoisted(() => ({
    config: {
        ai: {embedding: {enabled: false}},
        fileTree: {noSplitScreenWhenOpenTab: false},
    },
    getAllModels: vi.fn(),
    layout: {centerLayout: {children: [{}, {}]}},
    storage: {
        search: {
            method: 4,
            group: 1,
            sort: 2,
            types: {document: true},
            subTypes: {heading: true},
            replaceTypes: {text: true},
            removed: true,
        },
    },
}));

vi.mock("../../src/search/global/imports", () => ({
    Constants: {LOCAL_SEARCHDATA: "search"},
    getAllModels: runtime.getAllModels,
    getSiyuanConfig: () => runtime.config,
    getSiyuanLayout: () => runtime.layout,
    getSiyuanStorage: () => runtime.storage,
}));

import {openGlobalSearch} from "../../src/search/global/openGlobalSearch";

describe("open global search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.innerWidth = 1440;
    });

    it("synchronously reuses the first Search model and preserves update order", () => {
        const calls: string[] = [];
        const switchTab = vi.fn(() => calls.push("switchTab"));
        const updateSearch = vi.fn(() => calls.push("updateSearch"));
        runtime.getAllModels.mockReturnValue({
            search: [{parent: {headElement: document.createElement("div"), parent: {switchTab}}, updateSearch}],
        });
        const app = createTestAppFacade();
        app.openTab = vi.fn();

        openGlobalSearch(app, {text: "  query  ", replace: true});

        expect(calls).toEqual(["switchTab", "updateSearch"]);
        expect(updateSearch).toHaveBeenCalledWith("query", true);
        expect(app.openTab).not.toHaveBeenCalled();
    });

    it("creates a split Search from cloned local preferences when no model exists", () => {
        runtime.getAllModels.mockReturnValue({search: []});
        const app = createTestAppFacade();
        app.openTab = vi.fn(async () => undefined);

        openGlobalSearch(app, {text: "  query  ", replace: false});

        expect(app.openTab).toHaveBeenCalledWith({
            searchData: {
                k: "query",
                r: "",
                hasReplace: false,
                method: 0,
                hPath: "",
                idPath: [],
                group: 1,
                sort: 2,
                types: {document: true},
                subTypes: {heading: true},
                replaceTypes: {text: true},
                removed: true,
                page: 1,
            },
            position: "right",
        });
        const opened = vi.mocked(app.openTab).mock.calls[0]?.[0].searchData;
        expect(opened?.types).not.toBe(runtime.storage.search.types);
        expect(opened?.subTypes).not.toBe(runtime.storage.search.subTypes);
        expect(opened?.replaceTypes).not.toBe(runtime.storage.search.replaceTypes);
    });
});
