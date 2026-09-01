import {beforeEach, describe, expect, it, vi} from "vitest";

const mocks = vi.hoisted(() => ({
    addItem: vi.fn(),
    getFieldsByData: vi.fn(),
    menuOpen: vi.fn(),
    setPosition: vi.fn(),
    submitAVSortTransaction: vi.fn(),
}));

vi.mock("../../src/protyle/render/av/sorting/imports", () => ({
    Constants: {MENU_AV_ADD_SORT: "av-add-sort"},
    Menu: class {
        addItem = mocks.addItem;
        open = mocks.menuOpen;
    },
    escapeHtml: vi.fn((value: string) => value.replaceAll("<", "&lt;")),
    getColIconByType: vi.fn(() => "iconText"),
    getFieldsByData: mocks.getFieldsByData,
    setPosition: mocks.setPosition,
    siyuanI18n: {
        addSort: "Add sort",
        asc: "Ascending",
        desc: "Descending",
        endDate: "End date",
        removeSorts: "Remove sorts",
        sort: "Sort",
        startDate: "Start date",
    },
    submitAVSortTransaction: mocks.submitAVSortTransaction,
    unicode2Emoji: vi.fn((value: string) => value),
}));

import {addSort, bindSortsEvent, getSortsHTML} from "../../src/protyle/render/av/sorting";

const fields = [
    {id: "name", name: "Name", type: "text"},
    {id: "created", name: "Created", type: "created"},
    {id: "period", name: "Period <unsafe>", type: "date"},
] as IAVColumn[];

const createData = (sorts: IAVSort[]) => ({
    id: "av-id",
    view: {sorts},
}) as IAV;

describe("AV sorting lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getFieldsByData.mockReturnValue(fields);
    });

    it("adds a sort from the field menu before refreshing and positioning the panel", () => {
        const data = createData([]);
        const menuElement = document.createElement("div");
        Object.defineProperty(menuElement, "clientWidth", {value: 120});
        const protyle = {} as IProtyle;

        addSort({
            avId: "av-id",
            blockID: "block-id",
            data,
            menuElement,
            protyle,
            rect: {bottom: 40, height: 20, left: 10} as DOMRect,
            tabRect: {bottom: 80, height: 24, right: 300} as DOMRect,
        });

        expect(mocks.addItem).toHaveBeenCalledTimes(3);
        const createdItem = mocks.addItem.mock.calls[0][0] as {click: () => void};
        createdItem.click();

        expect(data.view.sorts).toEqual([{column: "name", order: "ASC"}]);
        expect(mocks.submitAVSortTransaction).toHaveBeenCalledWith(protyle, [{
            action: "setAttrViewSorts",
            avID: "av-id",
            blockID: "block-id",
            data: data.view.sorts,
        }], [{
            action: "setAttrViewSorts",
            avID: "av-id",
            blockID: "block-id",
            data: [],
        }]);
        expect(menuElement.querySelector('[data-id="name"]')).not.toBeNull();
        expect(mocks.setPosition).toHaveBeenCalledWith(menuElement, 180, 80, 24, 0);
        expect(mocks.submitAVSortTransaction.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.setPosition.mock.invocationCallOrder[0]);
    });

    it("changes a sort field while preserving the exact undo snapshot", () => {
        const originalSorts: IAVSort[] = [{column: "name", order: "ASC"}];
        const data = createData(originalSorts);
        const menuElement = document.createElement("div");
        menuElement.innerHTML = getSortsHTML(fields, data.view.sorts);

        bindSortsEvent({protyle: {} as IProtyle, menuElement, data, blockID: "block-id"});
        const fieldSelect = menuElement.querySelector("select") as HTMLSelectElement;
        fieldSelect.value = "created";
        fieldSelect.dispatchEvent(new Event("change"));

        expect(data.view.sorts).toBe(originalSorts);
        expect(data.view.sorts).toEqual([{column: "created", order: "ASC"}]);
        expect(fieldSelect.parentElement?.getAttribute("data-id")).toBe("created");
        expect(mocks.submitAVSortTransaction).toHaveBeenCalledWith(expect.anything(), [{
            action: "setAttrViewSorts",
            avID: "av-id",
            blockID: "block-id",
            data: originalSorts,
        }], [{
            action: "setAttrViewSorts",
            avID: "av-id",
            blockID: "block-id",
            data: [{column: "name", order: "ASC"}],
        }]);
    });

    it("changes sort direction without replacing the original sort array", () => {
        const originalSorts: IAVSort[] = [{column: "name", order: "ASC"}];
        const data = createData(originalSorts);
        const menuElement = document.createElement("div");
        menuElement.innerHTML = getSortsHTML(fields, data.view.sorts);

        bindSortsEvent({protyle: {} as IProtyle, menuElement, data, blockID: "block-id"});
        const directionSelect = menuElement.querySelector('[data-type="sortOrder"]') as HTMLSelectElement;
        directionSelect.value = "DESC";
        directionSelect.dispatchEvent(new Event("change"));

        expect(data.view.sorts).toBe(originalSorts);
        expect(data.view.sorts).toEqual([{column: "name", order: "DESC"}]);
        expect(mocks.submitAVSortTransaction.mock.calls[0][2][0].data)
            .toEqual([{column: "name", order: "ASC"}]);
    });

    it("renders and updates date endpoints while escaping field names", () => {
        const originalSorts: IAVSort[] = [{column: "period", order: "ASC"}];
        const data = createData(originalSorts);
        const menuElement = document.createElement("div");
        menuElement.innerHTML = getSortsHTML(fields, data.view.sorts);

        expect(menuElement.innerHTML).toContain("Period &lt;unsafe&gt;");
        const endpointSelect = menuElement.querySelector('[data-type="sortDateEndpoint"]') as HTMLSelectElement;
        expect(endpointSelect.value).toBe("start");
        bindSortsEvent({protyle: {} as IProtyle, menuElement, data, blockID: "block-id"});
        endpointSelect.value = "end";
        endpointSelect.dispatchEvent(new Event("change"));

        expect(data.view.sorts).toEqual([{column: "period", order: "ASC", dateEndpoint: "end"}]);
        expect(mocks.submitAVSortTransaction.mock.calls[0][2][0].data)
            .toEqual([{column: "period", order: "ASC"}]);
    });
});
