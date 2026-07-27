import {describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

vi.mock("../../src/search/assets", () => ({renderPreview: vi.fn(), renderNextAssetMark: vi.fn()}));
vi.mock("../../src/search/editor/openSearchEditor", () => ({openSearchEditor: vi.fn()}));
vi.mock("../../src/search/result/renderNextSearchMark", () => ({renderNextSearchMark: vi.fn()}));
vi.mock("../../src/search/article/getArticle", () => ({getArticle: vi.fn()}));
vi.mock("../../src/util/file/pathName", () => ({useShell: vi.fn()}));

import {handleListItemClick} from "../../src/search/utils/genSearch/handlers/handleListItemClick";

/** Build the complete list-click context used by the Search handler. */
const createContext = (method: number) => {
    const app = createTestAppFacade();
    app.createDocument = vi.fn(async () => undefined);
    const searchInputElement = document.createElement("input");
    searchInputElement.value = "new document";
    return {
        app,
        element: document.createElement("section"),
        edit: createProtyleDomainFixture(),
        unRefEdit: createProtyleDomainFixture(),
        config: {method},
        searchInputElement,
        searchPanelElement: document.createElement("div"),
        unRefPanelElement: document.createElement("div"),
        closeCB: undefined,
        clickTimeout: 31,
        lastClickTime: 47,
    };
};

describe("Search list new-document item", () => {
    it("delegates SQL search creation to the complete AppFacade and preserves click state", () => {
        const context = createContext(0);
        const target = document.createElement("button");
        target.dataset.type = "search-new";

        const result = handleListItemClick(target, new MouseEvent("click"), context);

        expect(context.app.createDocument).toHaveBeenCalledWith("new document");
        expect(result).toEqual({clickTimeout: 31, lastClickTime: 47});
    });

    it("does not create a document for non-SQL search methods", () => {
        const context = createContext(4);
        const target = document.createElement("button");
        target.dataset.type = "search-new";

        handleListItemClick(target, new MouseEvent("click"), context);

        expect(context.app.createDocument).not.toHaveBeenCalled();
    });
});
