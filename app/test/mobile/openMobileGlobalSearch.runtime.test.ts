import {describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";

const runtime = vi.hoisted(() => ({popSearch: vi.fn()}));

vi.mock("../../src/mobile/search/global/imports", () => ({popSearch: runtime.popSearch}));

import {openMobileGlobalSearch} from "../../src/mobile/search/global/openMobileGlobalSearch";

describe("mobile AppFacade global search", () => {
    it("maps a tag search to the existing full-screen mobile search configuration", () => {
        const app = createTestAppFacade();

        openMobileGlobalSearch(app, {text: "#tag#", searchData: {method: 0}});

        expect(runtime.popSearch).toHaveBeenCalledWith(app, {
            hasReplace: false,
            method: 0,
            hPath: "",
            idPath: [],
            k: "#tag#",
            r: "",
            page: 1,
        });
    });

    it("preserves caller path and page settings while forcing non-replace mobile presentation", () => {
        const app = createTestAppFacade();
        const idPath = ["notebook/document.sy"];

        openMobileGlobalSearch(app, {
            text: "query",
            searchData: {hasReplace: true, hPath: "/path", idPath, page: 3},
        });

        expect(runtime.popSearch).toHaveBeenCalledWith(app, expect.objectContaining({
            hasReplace: false,
            hPath: "/path",
            idPath,
            k: "query",
            page: 3,
        }));
    });
});
