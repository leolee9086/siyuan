import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    getAllTabs: vi.fn(),
    openFile: vi.fn(),
    openFileById: vi.fn(),
}));

vi.mock("../../src/layout/getAll", () => ({getAllTabs: mocks.getAllTabs}));
vi.mock("../../src/editor/open/openFile", () => ({openFile: mocks.openFile}));
vi.mock("../../src/editor/utils.openFileById", () => ({openFileById: mocks.openFileById}));

import {editorModelBrand} from "../../src/editor/model/editorDomain.types";
import {openDesktopDatabaseRow} from "../../src/editor/open/databaseRow/openDatabaseRow";
import {openDatabaseRowBlock} from "../../src/editor/open/databaseRow/openDatabaseRowBlock";
import type {AppDatabaseRowNavigation} from "../../src/app/AppFacade.types";
import {createTestAppFacade} from "../app/AppFacade.fixture";

const data: AppDatabaseRowNavigation = {
    avID: "av-id",
    databaseBlockID: "database-block-id",
    notebookID: "notebook-id",
    itemID: "item-id",
    valueID: "value-id",
    title: "Row title",
    boundBlockID: "bound-block-id",
    isDetached: false,
};

const createEditorModel = () => {
    const protyle = {
        element: document.createElement("div"),
        contentElement: document.createElement("div"),
        databaseAttributePanel: {expand: vi.fn()},
    };
    return {
        [editorModelBrand]: "Editor" as const,
        editor: {protyle},
        protyle,
    };
};

describe("database row navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getAllTabs.mockReturnValue([]);
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {languages: {untitled: "Untitled"}},
            writable: true,
        });
    });

    it("maps a detached row to the existing custom tab payload", () => {
        const app = createTestAppFacade();

        openDesktopDatabaseRow(app, {...data, isDetached: true});

        expect(mocks.openFile).toHaveBeenCalledWith({
            app,
            position: "right",
            removeCurrentTab: false,
            custom: {
                id: "siyuan-database-row",
                icon: "iconDatabase",
                title: "Row title",
                data: {
                    avID: "av-id",
                    blockID: "database-block-id",
                    notebookId: "notebook-id",
                    itemID: "item-id",
                    valueID: "value-id",
                    title: "Row title",
                },
            },
        });
    });

    it("maps a bound row to a database preview block navigation", () => {
        const openBlock = vi.fn();
        const app = createTestAppFacade(openBlock);

        openDesktopDatabaseRow(app, data);

        expect(openBlock).toHaveBeenCalledWith(expect.objectContaining({
            id: "bound-block-id",
            databaseRowId: "bound-block-id",
            zoomIn: true,
        }));
        expect(mocks.openFile).not.toHaveBeenCalled();
    });

    it("reuses an initialized preview tab and restores its panel state", () => {
        const model = createEditorModel();
        const tab = {
            model,
            headElement: document.createElement("div"),
            parent: {switchTab: vi.fn(), showHeading: vi.fn()},
        };
        model.protyle.element.dataset.databaseRowId = "bound-block-id";
        model.protyle.contentElement.scrollTop = 25;
        mocks.getAllTabs.mockReturnValue([tab]);

        openDatabaseRowBlock(createTestAppFacade(), {
            id: "bound-block-id", action: [], zoomIn: true, databaseRowId: "bound-block-id",
        });

        expect(tab.parent.switchTab).toHaveBeenCalledWith(tab.headElement);
        expect(tab.parent.showHeading).toHaveBeenCalledOnce();
        expect(model.protyle.databaseAttributePanel.expand).toHaveBeenCalledOnce();
        expect(model.protyle.contentElement.scrollTop).toBe(0);
        expect(mocks.openFileById).not.toHaveBeenCalled();
    });

    it("opens a new preview and applies the preview state after initialization", () => {
        const app = createTestAppFacade();
        openDatabaseRowBlock(app, {
            id: "bound-block-id", action: [], zoomIn: true, databaseRowId: "bound-block-id",
        });
        const call = mocks.openFileById.mock.calls[0];
        expect(call).toBeDefined();
        const options = call?.[0];
        if (!options) {
            throw new Error("Expected database row preview navigation");
        }
        const model = createEditorModel();

        options.afterOpen(model);

        expect(options).toMatchObject({
            app,
            id: "bound-block-id",
            position: "right",
            openNewTab: true,
            removeCurrentTab: false,
            zoomIn: true,
        });
        expect(model.protyle.element.dataset.databaseRowId).toBe("bound-block-id");
        expect(model.protyle.databaseAttributePanel.expand).toHaveBeenCalledOnce();
    });

    it("keeps malformed saved tab data observable and continues with a new preview", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const headElement = document.createElement("div");
        headElement.setAttribute("data-initdata", "{");
        mocks.getAllTabs.mockReturnValue([{
            model: {},
            headElement,
        }]);

        openDatabaseRowBlock(createTestAppFacade(), {
            id: "bound-block-id", action: [], zoomIn: true, databaseRowId: "bound-block-id",
        });

        expect(warn).toHaveBeenCalledOnce();
        expect(mocks.openFileById).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});
