import {beforeEach, describe, expect, it, vi} from "vitest";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

const runtime = vi.hoisted(() => ({
    calls: [] as string[],
    inputEvent: vi.fn((_element: Element, _config: Config.IUILayoutTabSearchConfig, _edit: object) =>
        runtime.calls.push("inputEvent")),
    setStorageVal: vi.fn(() => runtime.calls.push("setStorageVal")),
    storage: {} as Record<string, Config.IUILayoutTabSearchConfig>,
}));

vi.mock("../../src/search/config/imports", () => ({
    Constants: {
        DIALOG_SEARCH: "search",
        LOCAL_SEARCHDATA: "local-search-data",
    },
    escapeHtml: (value: string) => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    hasClosestByClassName: (element: Element, className: string) => element.closest(`.${className}`),
    getSiyuanGlobalMenusMenu: () => window.siyuan.menus?.menu,
    getSiyuanStorage: () => window.siyuan.storage,
    isHTMLInputElement: (node: unknown): node is HTMLInputElement => node instanceof HTMLInputElement,
    setStorageVal: runtime.setStorageVal,
    siyuanI18n: {
        keyword: "Keyword",
        querySyntax: "Query syntax",
        regex: "Regex",
        searchMethod: "Search method",
        semanticSearch: "Semantic search",
    },
}));

import {genQueryHTML, updateConfig} from "../../src/search/config/searchConfig";

const createConfig = (overrides: Partial<{
    group: number;
    hPath: string;
    hasReplace: boolean;
    idPath: string[];
    k: string;
    method: number;
    r: string;
}> = {}) => {
    const config = {
        group: 0,
        hPath: "",
        hasReplace: false,
        idPath: [] as string[],
        k: "keyword",
        method: 0,
        r: "replacement",
    } satisfies Config.IUILayoutTabSearchConfig;
    Object.assign(config, overrides);
    return config;
};

/** Build the controls consumed by updateConfig so each test exercises the real DOM operations. */
const createSearchElement = () => {
    const element = document.createElement("section");
    element.innerHTML = `
        <div class="search__header"></div>
        <div class="search__header fn__none"></div>
        <button id="searchPathInput"></button>
        <div class="fn__none"><button id="searchExpand"></button></div>
        <button id="searchInclude"><span></span></button>
        <input id="searchInput" value="old keyword">
        <input id="replaceInput" value="old replacement">
        <span id="searchSyntaxCheck"></span>`;
    return element;
};

describe("desktop search configuration", () => {
    beforeEach(() => {
        runtime.calls.length = 0;
        runtime.inputEvent.mockClear();
        runtime.setStorageVal.mockClear();
        runtime.storage = {};
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {
                menus: {menu: {remove: vi.fn(() => runtime.calls.push("removeMenu"))}},
                storage: runtime.storage,
            },
        });
    });

    it.each([
        [0, "Keyword", "Exact"],
        [1, "Query syntax", "Quote"],
        [2, "SQL", "Database"],
        [3, "Regex", "Regex"],
        [4, "Semantic search", "Sparkles"],
    ])("renders method %i with its label and icon", (method, label, icon) => {
        const html = genQueryHTML(method, "syntax");

        expect(html).toContain('id="syntax"');
        expect(html).toContain(`aria-label="Search method ${label}"`);
        expect(html).toContain(`xlink:href="#icon${icon}"`);
    });

    it("updates controls and persists before refreshing and closing the menu", () => {
        const element = createSearchElement();
        const item = createConfig({
            group: 1,
            hPath: "Notebook <One>",
            hasReplace: true,
            idPath: ["notebook/path"],
            method: 3,
        });
        const previous = createConfig();
        const edit = createProtyleDomainFixture();

        const result = updateConfig({element, item, config: previous, edit, refresh: runtime.inputEvent});

        expect(element.querySelectorAll(".search__header")[1]?.classList.contains("fn__none")).toBe(false);
        expect(element.querySelector("#searchPathInput")?.innerHTML).toContain("Notebook &lt;One&gt;");
        expect(element.querySelector("#searchPathInput")?.getAttribute("aria-label")).toBe("Notebook &lt;One&gt;");
        expect(element.querySelector("#searchExpand")?.parentElement?.classList.contains("fn__none")).toBe(false);
        expect(element.querySelector("#searchInclude")?.firstElementChild?.classList.contains("ft__primary")).toBe(true);
        expect(element.querySelector("#searchInclude")?.hasAttribute("disabled")).toBe(false);
        expect((element.querySelector("#searchInput") as HTMLInputElement).value).toBe("keyword");
        expect((element.querySelector("#replaceInput") as HTMLInputElement).value).toBe("replacement");
        expect(element.querySelector("#searchSyntaxCheck use")?.getAttribute("xlink:href")).toBe("#iconRegex");
        expect(runtime.storage["local-search-data"]).toEqual(item);
        expect(runtime.storage["local-search-data"]).not.toBe(item);
        expect(runtime.setStorageVal).toHaveBeenCalledWith("local-search-data", runtime.storage["local-search-data"]);
        expect(runtime.inputEvent).toHaveBeenCalledWith(element, item, edit);
        expect(runtime.inputEvent.mock.calls[0]?.[1]).not.toBe(item);
        expect(result).toBeUndefined();
        expect(runtime.calls).toEqual(["setStorageVal", "inputEvent", "removeMenu"]);
    });

    it("inherits the active dialog path and fails visibly when a required input is missing", () => {
        const dialog = document.createElement("div");
        dialog.className = "b3-dialog--open";
        dialog.dataset.key = "search";
        const element = createSearchElement();
        element.querySelector("#replaceInput")?.remove();
        dialog.append(element);
        const item = createConfig({hPath: "incoming", idPath: ["incoming/path"]});
        const previous = createConfig({hPath: "current", idPath: ["current/path.sy"]});

        expect(() => updateConfig({element, item, config: previous, edit: createProtyleDomainFixture(),
            refresh: runtime.inputEvent})).toThrowError(
            "Search input is missing: #replaceInput",
        );
        expect(item.hPath).toBe("current");
        expect(item.idPath).toEqual(["current/path.sy"]);
        expect(runtime.setStorageVal).not.toHaveBeenCalled();
        expect(runtime.inputEvent).not.toHaveBeenCalled();
    });
});
