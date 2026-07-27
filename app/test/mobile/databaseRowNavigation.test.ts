import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    renderAVAttribute: vi.fn(),
}));

vi.mock("../../src/protyle/render/av/blockAttr", () => ({
    renderAVAttribute: mocks.renderAVAttribute,
}));

vi.mock("../../src/dialog", () => ({
    Dialog: class {
        element: HTMLElement;

        constructor(options: {content: string}) {
            this.element = document.createElement("div");
            this.element.innerHTML = options.content;
        }
    },
}));

import {openMobileDatabaseRow} from "../../src/mobile/databaseRow.factory";
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

describe("mobile database row navigation", () => {
    const destroy = vi.fn();
    const removeMenu = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {
                dialogs: [{
                    element: Object.assign(document.createElement("div"), {innerHTML: '<div class="protyle-db-row--mobile"></div>'}),
                    destroy,
                }],
                languages: {untitled: "Untitled"},
                menus: {menu: {remove: removeMenu}},
            },
            writable: true,
        });
    });

    it("replaces the previous mobile detail and renders a detached row", () => {
        const protyle = {} as IProtyle;
        const openBlock = vi.fn();
        const app = createTestAppFacade(openBlock);

        openMobileDatabaseRow(app, protyle, {...data, isDetached: true});

        expect(destroy).toHaveBeenCalledOnce();
        expect(mocks.renderAVAttribute).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            "item-id",
            protyle,
            undefined,
            {avID: "av-id", itemID: "item-id", valueID: "value-id"},
        );
        expect(openBlock).not.toHaveBeenCalled();
        expect(removeMenu).not.toHaveBeenCalled();
    });

    it("closes mobile overlays before opening a bound row preview", () => {
        const openBlock = vi.fn();
        const app = createTestAppFacade(openBlock);

        openMobileDatabaseRow(app, {} as IProtyle, data);

        expect(destroy).toHaveBeenCalledOnce();
        expect(removeMenu).toHaveBeenCalledOnce();
        expect(openBlock).toHaveBeenCalledWith(expect.objectContaining({
            id: "bound-block-id",
            databaseRowId: "bound-block-id",
            zoomIn: true,
        }));
        expect(mocks.renderAVAttribute).not.toHaveBeenCalled();
    });
});
