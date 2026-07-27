import {beforeEach, describe, expect, it, vi} from "vitest";
import {createTestAppFacade} from "../app/AppFacade.fixture";
import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

import {Constants} from "../../src/constants";
import {initSearchEditors} from "../../src/search/utils/genSearch/initSearchEditors";

/** Build the two required preview hosts. */
const createSearchRoot = () => {
    const root = document.createElement("section");
    root.innerHTML = '<div id="searchPreview"></div><div id="searchUnRefPreview"></div>';
    return root;
};

/** Create an AppFacade whose Protyle composition boundary records both preview editors. */
const createEditorHost = () => {
    const app = createTestAppFacade();
    const edit = createProtyleDomainFixture({element: document.createElement("div")});
    const unRefEdit = createProtyleDomainFixture({element: document.createElement("div")});
    edit.resize = vi.fn();
    unRefEdit.resize = vi.fn();
    const editors = [edit, unRefEdit];
    const createProtyle = vi.fn(() => {
        const editor = editors.shift();
        if (!editor) {
            throw new Error("Unexpected search editor creation");
        }
        return editor;
    });
    app.createProtyle = createProtyle;
    return {app, createProtyle, edit, unRefEdit};
};

/** Install one layout snapshot into the initialized test storage. */
const setLayoutData = (data: object) => {
    const storage = window.siyuan.storage;
    if (!storage) {
        throw new Error("Test Siyuan storage is missing");
    }
    storage[Constants.LOCAL_SEARCHKEYS] = data;
};

describe("search preview editor initialization", () => {
    beforeEach(() => {
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {storage: {}},
        });
    });

    it("creates both editors through AppFacade and restores popup column layout", () => {
        setLayoutData({layout: 1, col: "320px"});
        const root = createSearchRoot();
        const {app, createProtyle, edit, unRefEdit} = createEditorHost();

        const result = initSearchEditors(app, root, true);

        expect(result).toEqual({edit, unRefEdit});
        expect(createProtyle).toHaveBeenNthCalledWith(1, root.querySelector("#searchPreview"), {
            blockId: "",
            render: {background: true, gutter: true, breadcrumbDocName: true, title: true},
        });
        expect(createProtyle).toHaveBeenNthCalledWith(2, root.querySelector("#searchUnRefPreview"), {
            blockId: "",
            render: {gutter: true, breadcrumbDocName: true, title: true},
        });
        expect(edit.resize).toHaveBeenCalledOnce();
        expect(unRefEdit.resize).toHaveBeenCalledOnce();
        expect(edit.protyle.element.style.width).toBe("320px");
        expect(edit.protyle.element.classList.contains("fn__flex-1")).toBe(false);
    });

    it("restores tab row layout without applying popup dimensions", () => {
        setLayoutData({layoutTab: 0, rowTab: "240px", col: "320px"});
        const root = createSearchRoot();
        const {app, edit} = createEditorHost();

        initSearchEditors(app, root, false);

        expect(edit.protyle.element.style.height).toBe("240px");
        expect(edit.protyle.element.style.width).toBe("");
    });
});
