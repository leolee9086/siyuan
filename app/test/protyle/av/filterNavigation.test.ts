import {beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../src/protyle/wysiwyg/transaction/submit", () => ({transaction: vi.fn()}));

const messages: string[] = [];
let setFilter: typeof import("../../../src/protyle/render/av/filter").setFilter;

beforeAll(async () => {
    const menuElement = document.createElement("div");
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {lang: "en_US"},
            languages: {plsChoose: "Choose a target field"},
            menus: {
                menu: {
                    element: menuElement,
                    remove() {},
                },
            },
        },
    });

    const {setProtyleDialogPort} = await import("../../../src/protyle/runtime/dialog.port");
    setProtyleDialogPort({
        showMessage(message) {
            messages.push(message);
        },
    });
    ({setFilter} = await import("../../../src/protyle/render/av/filter"));
});

beforeEach(() => {
    messages.length = 0;
    document.body.innerHTML = "";
});

describe("AV filter navigation", () => {
    it("returns the Rollup column that requires configuration after clearing the old panel", async () => {
        const oldPanel = document.createElement("div");
        oldPanel.className = "av__panel";
        document.body.append(oldPanel);

        const target = document.createElement("div");
        target.getBoundingClientRect = () => new DOMRect(0, 0, 0, 24);
        const blockElement = document.createElement("div");
        const rollupColumn = {
            id: "rollup-column",
            type: "rollup",
        };
        const filter = {
            column: rollupColumn.id,
            operator: "Contains",
            value: {type: "rollup", rollup: {contents: []}},
        };
        const data = {
            id: "av-id",
            view: {
                type: "table",
                columns: [rollupColumn],
                filters: [filter],
            },
        };

        const editColumnId = await setFilter({
            filter,
            protyle: {},
            data,
            target,
            blockElement,
            empty: false,
        });

        expect(editColumnId).toBe(rollupColumn.id);
        expect(messages).toEqual(["Choose a target field"]);
        expect(document.querySelector(".av__panel")).toBeNull();
    });
});
