import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    clearViewGroupData: vi.fn(),
    setPosition: vi.fn(),
    submit: vi.fn(),
}));

vi.mock("../../../src/protyle/render/av/group/panel/imports", () => ({
    bindGroupsEvent: vi.fn(),
    bindGroupsNumber: vi.fn(),
    clearViewGroupData: mocks.clearViewGroupData,
    getFieldsByData: vi.fn(() => []),
    getGroupsHTML: vi.fn(() => "<div data-groups-refreshed></div>"),
    getGroupsMethodHTML: vi.fn(() => ""),
    getGroupsNumberHTML: vi.fn(() => ""),
    goGroupsDate: vi.fn(),
    goGroupsSort: vi.fn(),
    removeSiyuanMenu: vi.fn(),
    setGroupMethod: vi.fn(),
    setPosition: mocks.setPosition,
    siyuanI18n: {hideAll: "Hide all", showAll: "Show all"},
    submitAVGroupTransaction: mocks.submit,
}));

import {handleGroupsClick} from "../../../src/protyle/render/av/group/panel/interactions";
import {avMenuPanelDomainBrand} from "../../../src/protyle/render/av/openMenuPanel.types";
import type {IMenuPanelContext} from "../../../src/protyle/render/av/openMenuPanel.types";

const createContext = (groups: IAVView[]) => {
    const menuElement = document.createElement("div");
    const blockElement = document.createElement("div");
    const data = {id: "av-id", view: {groups, group: {}}} as IAV;
    const context: IMenuPanelContext = {
        options: {protyle: {} as IProtyle, blockElement, type: "config"},
        panel: {
            [avMenuPanelDomainBrand]: "AVMenuPanelDomain",
            open: vi.fn(),
            openViewMenu: vi.fn(),
        },
        data,
        fields: [],
        avID: "av-id",
        blockID: "block-id",
        isCustomAttr: false,
        menuElement,
        avPanelElement: document.createElement("div"),
        tabRect: new DOMRect(0, 0, 100, 20),
    };
    return context;
};

const createEvent = () => {
    const event = new MouseEvent("click");
    vi.spyOn(event, "preventDefault");
    vi.spyOn(event, "stopPropagation");
    return event;
};

beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
});

describe("group panel interactions", () => {
    it("hides one group and preserves its previous hidden value in undo", async () => {
        const group = {id: "group-id", groupHidden: 0} as IAVView;
        const context = createContext([group]);
        context.menuElement.innerHTML = `
            <div><button data-id="group-id"><use xlink:href="#iconEye"></use></button></div>
            <button data-type="hideGroups"></button>`;
        const target = context.menuElement.querySelector('[data-id="group-id"]') as HTMLElement;
        const event = createEvent();

        const useElement = target.firstElementChild;
        if (!useElement) {
            throw new Error("group visibility action requires a use element");
        }
        const setAttribute = vi.spyOn(useElement, "setAttribute");
        await handleGroupsClick({ctx: context, type: "hideGroup", target, event});

        expect(group.groupHidden).toBe(2);
        expect(setAttribute).toHaveBeenCalledWith("xlink:href", "#iconEyeoff");
        expect(mocks.submit).toHaveBeenCalledWith(context.options.protyle, [{
            action: "hideAttrViewGroup", avID: "av-id", blockID: "block-id", id: "group-id", data: 2,
        }], [{
            action: "hideAttrViewGroup", avID: "av-id", blockID: "block-id", id: "group-id", data: 0,
        }]);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
    });

    it("updates all group data and DOM before submitting the inverse toggle", async () => {
        const groups = [
            {id: "first", groupHidden: 0},
            {id: "second", groupHidden: 0},
        ] as IAVView[];
        const context = createContext(groups);
        context.menuElement.innerHTML = `
            <div><button data-type="hideGroups"><svg><use xlink:href="#iconEyeoff"></use></svg></button></div>
            <div>
                <button class="b3-menu__item" data-id="first"><span class="b3-menu__action"><svg><use></use></svg></span></button>
                <button class="b3-menu__item" data-id="second"><span class="b3-menu__action"><svg><use></use></svg></span></button>
            </div>`;
        const target = context.menuElement.querySelector('[data-type="hideGroups"]') as HTMLElement;

        await handleGroupsClick({ctx: context, type: "hideGroups", target, event: createEvent()});

        expect(groups.map(group => group.groupHidden)).toEqual([2, 2]);
        expect(context.menuElement.querySelectorAll(".b3-menu__item--hidden")).toHaveLength(2);
        expect(mocks.submit).toHaveBeenCalledWith(context.options.protyle, [{
            action: "hideAttrViewAllGroups", avID: "av-id", blockID: "block-id", data: true,
        }], [{
            action: "hideAttrViewAllGroups", avID: "av-id", blockID: "block-id", data: false,
        }]);
    });

    it("submits removal before clearing data and refreshing the panel", async () => {
        const context = createContext([]);
        const event = createEvent();

        await handleGroupsClick({ctx: context, type: "removeGroups", target: document.createElement("button"), event});

        expect(mocks.submit).toHaveBeenCalledWith(context.options.protyle, [{
            action: "removeAttrViewGroup", avID: "av-id", blockID: "block-id",
        }], [{
            action: "setAttrViewGroup", avID: "av-id", blockID: "block-id", data: context.data.view.group,
        }]);
        expect(mocks.clearViewGroupData).toHaveBeenCalledWith(context.data.view);
        expect(context.menuElement.querySelector("[data-groups-refreshed]")).not.toBeNull();
        expect(mocks.setPosition).toHaveBeenCalledOnce();
        const submitOrder = mocks.submit.mock.invocationCallOrder.reduce(first => first);
        const clearOrder = mocks.clearViewGroupData.mock.invocationCallOrder.reduce(first => first);
        const positionOrder = mocks.setPosition.mock.invocationCallOrder.reduce(first => first);
        expect(submitOrder).toBeLessThan(clearOrder);
        expect(clearOrder).toBeLessThan(positionOrder);
    });
});
