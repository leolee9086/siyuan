import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

const transaction = vi.fn();

vi.mock("../../../src/protyle/wysiwyg/transaction/submit", () => ({
    transaction,
}));
vi.mock("../../../src/util/siyuanEnvironments/i18n.getI18n.environment", () => ({
    siyuanI18n: new Proxy({}, {
        get: (_target, key) => String(key),
    }),
}));

let getFiltersHTML: typeof import("../../../src/protyle/render/av/filter").getFiltersHTML;
let bindInlineFilterEvents: typeof import("../../../src/protyle/render/av/filter").bindInlineFilterEvents;

beforeAll(async () => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {lang: "en_US"},
            languages: new Proxy({}, {
                get: (_target, key) => String(key),
            }),
            menus: {
                menu: {
                    element: document.createElement("div"),
                    remove() {},
                },
            },
        },
    });
    ({bindInlineFilterEvents, getFiltersHTML} = await import("../../../src/protyle/render/av/filter"));
});

beforeEach(() => {
    document.body.innerHTML = "";
    transaction.mockClear();
});

describe("AV inline select filter options", () => {
    it("renders each option as a full-width button with separate check and color-chip layers", () => {
        const data = {
            id: "av-id",
            view: {
                type: "table",
                columns: [{
                    id: "status",
                    name: "Status",
                    type: "select",
                    options: [
                        {name: "Done", color: "1"},
                        {name: "Todo", color: "2"},
                    ],
                }],
                filters: [{
                    column: "status",
                    operator: "=",
                    value: {
                        type: "select",
                        mSelect: [{content: "Done", color: "1"}],
                    },
                }],
            },
        } as IAV;

        document.body.innerHTML = getFiltersHTML(data);
        const optionElements = Array.from(document.querySelectorAll<HTMLElement>('[data-type="selectOption"]'));

        expect(optionElements).toHaveLength(2);
        expect(optionElements.every((element) => element.tagName === "BUTTON")).toBe(true);
        expect(optionElements[0].getAttribute("type")).toBe("button");
        expect(optionElements[0].querySelector(".av__select-option-check use")?.getAttribute("xlink:href")).toBe("#iconCheck");
        expect(optionElements[1].querySelector(".av__select-option-check use")?.getAttribute("xlink:href")).toBe("#iconUncheck");
        expect(optionElements[0].querySelector(".b3-chip")?.textContent).toBe("Done");
        expect(optionElements[0].classList.contains("b3-chip")).toBe(false);
    });

    it("keeps single-select state and transaction data in sync when an option button is clicked", () => {
        const data = {
            id: "av-id",
            view: {
                type: "table",
                columns: [{
                    id: "status",
                    name: "Status",
                    type: "select",
                    options: [
                        {name: "Done", color: "1"},
                        {name: "Todo", color: "2"},
                    ],
                }],
                filters: [{
                    column: "status",
                    operator: "=",
                    value: {
                        type: "select",
                        mSelect: [{content: "Done", color: "1"}],
                    },
                }],
            },
        } as IAV;
        const panelElement = document.createElement("div");
        panelElement.innerHTML = `<div class="b3-menu">${getFiltersHTML(data)}</div>`;
        document.body.appendChild(panelElement);
        bindInlineFilterEvents(panelElement, data, {} as IProtyle, "block-id", "av-id");

        const optionElements = panelElement.querySelectorAll<HTMLButtonElement>('[data-type="selectOption"]');
        optionElements[1].click();

        expect(optionElements[0].querySelector("use")?.getAttribute("xlink:href")).toBe("#iconUncheck");
        expect(optionElements[1].querySelector("use")?.getAttribute("xlink:href")).toBe("#iconCheck");
        expect(panelElement.querySelector<HTMLElement>('[data-type="selectTrigger"]')?.textContent).toBe("Todo");
        expect(data.view.filters[0].value.mSelect).toEqual([{content: "Todo", color: "2"}]);
        expect(transaction).toHaveBeenCalledOnce();
        const submittedOperation = transaction.mock.calls[0][1][0];
        expect(submittedOperation).toMatchObject({
            action: "setAttrViewFilters",
            avID: "av-id",
            blockID: "block-id",
        });
        expect(submittedOperation.data[0].value.mSelect).toEqual([{content: "Todo", color: "2"}]);
    });
});
