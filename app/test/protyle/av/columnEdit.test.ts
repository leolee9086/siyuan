import {beforeAll, describe, expect, it, vi} from "vitest";

vi.mock("../../../src/protyle/wysiwyg/transaction/submit", () => ({transaction: vi.fn()}));
vi.mock("../../../src/protyle/render/av/rollup", () => ({
    bindRollupData: vi.fn(),
    getRollupHTML: vi.fn(() => ""),
}));
vi.mock("../../../src/protyle/render/av/col/col.editPanel.bind", () => ({
    bindAddOptionEvent: vi.fn(),
    bindDateSwitchEvents: vi.fn(),
    bindDescEvents: vi.fn(),
    bindIncludeTimeEvent: vi.fn(),
    bindNameEvents: vi.fn(),
    bindTemplateEvents: vi.fn(),
    bindWrapEvent: vi.fn(),
}));
vi.mock("../../../src/protyle/render/av/col/col.editPanel.bind.relation", () => ({
    bindBackRelationEvents: vi.fn(),
}));

let getEditHTML: typeof import("../../../src/protyle/render/av/col/edit/render").getEditHTML;

beforeAll(async () => {
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: {
            config: {lang: "en_US"},
            languages: {
                addDesc: "Add description",
                delete: "Delete",
                duplicate: "Duplicate",
                edit: "Edit",
                text: "Text",
                type: "Type",
                wrap: "Wrap",
            },
        },
    });
    ({getEditHTML} = await import("../../../src/protyle/render/av/col/edit/render"));
});

const createTextColumn = () => ({
    id: "column-id",
    type: "text",
    icon: "",
    name: "Column name",
    desc: "Description <value>",
    wrap: true,
});

const createData = (columns = [createTextColumn()]) => ({
    id: "av-id",
    view: {
        type: "table",
        columns,
    },
});

describe("AV column edit rendering", () => {
    it("preserves the main editor and complete type chooser protocol", () => {
        const html = getEditHTML({
            protyle: {},
            colId: "column-id",
            data: createData(),
            isCustomAttr: false,
        });

        expect(html).toContain('data-col-id="column-id"');
        expect(html).toContain('data-type="name"');
        expect(html).toContain('data-type="desc"');
        expect(html).toContain('data-type="wrap" class="b3-switch b3-switch--menu" checked');
        expect(html).toContain('data-type="duplicateCol"');
        expect(html).toContain('data-type="removeCol"');
        expect(html.match(/data-type="updateColType"/g)).toHaveLength(16);
    });

    it("reports a missing column instead of rendering an invalid panel", () => {
        expect(() => getEditHTML({
            protyle: {},
            colId: "missing-column",
            data: createData([]),
            isCustomAttr: false,
        })).toThrow("AV column edit expected column missing-column");
    });
});
