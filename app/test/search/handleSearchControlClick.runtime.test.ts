import {describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";

vi.mock("../../src/util/storage/setStorageVal", () => ({setStorageVal: vi.fn()}));
vi.mock("../../src/menus/Menu.Item", () => ({MenuItem: vi.fn()}));
vi.mock("../../src/protyle/util/hasClosest", () => ({hasClosestByClassName: vi.fn()}));
vi.mock("../../src/protyle/util/resize", () => ({resize: vi.fn()}));
vi.mock("../../src/search/inputEvent", () => ({inputEvent: vi.fn()}));
vi.mock("../../src/search/menu", () => ({moreMenu: vi.fn(), queryMenu: vi.fn()}));
vi.mock("../../src/search/toggleHistory", () => ({toggleReplaceHistory: vi.fn()}));
vi.mock("../../src/search/config/searchConfig", () => ({genQueryHTML: vi.fn(), updateConfig: vi.fn()}));

import {handleSearchOpen} from "../../src/search/utils/genSearch/handlers/handleSearchControlClick";

const installSearchLayout = (noSplitScreenWhenOpenTab: boolean) => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {fileTree: {noSplitScreenWhenOpenTab}},
            layout: {centerLayout: {children: [{}]}},
        },
    });
};

describe("Search open command", () => {
    it("writes current inputs and delegates a right-side Search tab to AppFacade before closing", () => {
        installSearchLayout(false);
        Object.defineProperty(window, "innerWidth", {configurable: true, value: 1440});
        const order: string[] = [];
        const app = createTestAppFacade();
        app.openTab = vi.fn(async () => {
            order.push("open");
            return undefined;
        });
        const config = {k: "old", r: "old replacement"};
        const searchInput = document.createElement("input");
        searchInput.value = "current query";
        const replaceInput = document.createElement("input");
        replaceInput.value = "current replacement";

        handleSearchOpen(app, config, searchInput, replaceInput, () => order.push("close"));

        expect(config).toMatchObject({k: "current query", r: "current replacement"});
        expect(app.openTab).toHaveBeenCalledWith({searchData: config, position: "right"});
        expect(order).toEqual(["open", "close"]);
    });

    it("keeps the Search tab unsplit when the host preference disables splitting", () => {
        installSearchLayout(true);
        const app = createTestAppFacade();
        app.openTab = vi.fn(async () => undefined);

        handleSearchOpen(app, {}, document.createElement("input"), document.createElement("input"));

        expect(app.openTab).toHaveBeenCalledWith({searchData: {k: "", r: ""}, position: undefined});
    });
});
