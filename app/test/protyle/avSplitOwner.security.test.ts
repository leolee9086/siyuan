import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {buildFilterMenuItems} from "../../src/protyle/render/av/filter.menu";
import {getTableHTMLs} from "../../src/protyle/render/av/render.table";
import {genAVValueHTML} from "../../src/protyle/render/av/value/render";
import {renderCheckboxCell} from "../../src/protyle/render/av/cell/render.helpers";

const malicious = `"><img src=x onerror="alert(1)">`;

const installRenderingGlobals = () => {
    Object.defineProperty(globalThis, "Lute", {
        configurable: true,
        value: {
            EscapeHTMLStr: (value: string) => value
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll("\"", "&quot;"),
            Sanitize: (value: string) => value,
        },
    });
    Object.assign(window, {
        siyuan: {
            config: {editor: {allowHTMLBLockScript: false}},
            languages: {
                search: "Search",
                calc: "Calc",
                newCol: "New column",
                newRow: "New row",
                loadMore: "Load more",
            },
            storage: {},
        },
    });
};

describe("AV split-owner security (GHSA-m7cc-jh9q-wxg8 and GHSA-vx5w-qrvp-mmcq)", () => {
    it("escapes stored select fields in the active filter-menu renderer", () => {
        installRenderingGlobals();
        const items: Array<{label?: string}> = [];
        const menu = {
            addItem: (item: {label?: string}) => items.push(item),
        } as unknown as Menu;

        buildFilterMenuItems(menu, {
            type: "select",
            mSelect: [],
        } as IAVCellValue, {
            options: [{name: malicious, color: malicious}],
        } as IAVColumn, {} as IAVFilter);

        const label = items.find((item) => item.label?.includes("b3-chip"))?.label ?? "";
        expect(label).not.toContain(`<img src=x onerror="alert(1)">`);
        expect(label).toContain("&lt;img");
        expect(label).toContain("&quot;");
    });

    it("escapes a persisted column icon in the active table renderer", async () => {
        installRenderingGlobals();
        const html = await getTableHTMLs({
            columns: [{
                id: "20260828000000-test",
                icon: malicious,
                hidden: false,
                pin: false,
                width: "200px",
                type: "text",
                wrap: false,
                desc: "",
                align: "",
            }],
            rows: [],
            pageSize: 20,
            rowCount: 0,
            showIcon: true,
        } as IAVTable, document.createElement("div"));

        expect(html).not.toContain(`data-icon="${malicious}"`);
        expect(html).toContain("data-icon=\"&quot;");
    });

    it("escapes a persisted relation icon in the split value renderer", () => {
        installRenderingGlobals();
        const html = genAVValueHTML({
            type: "relation",
            relation: {
                blockIDs: ["20260828000000-test"],
                contents: [{
                    block: {
                        id: "20260828000000-test",
                        icon: malicious,
                        content: "Related document",
                    },
                    isDetached: false,
                }],
            },
        } as IAVCellValue);

        expect(html).not.toContain(`data-unicode="${malicious}"`);
        expect(html).toContain("data-unicode=\"&quot;");
    });

    it("escapes checkbox labels rendered in gallery and kanban cards", () => {
        const html = renderCheckboxCell({
            type: "checkbox",
            checkbox: {checked: true, content: malicious},
        } as IAVCellValue, "gallery");

        expect(html).not.toContain(`<img src=x onerror="alert(1)">`);
        expect(html).toContain("&lt;img");
    });

    it("keeps private split column insertion and editing owners escaped", () => {
        const addSource = readFileSync("src/protyle/render/av/col/add/presentation.ts", "utf8");
        const editSource = readFileSync("src/protyle/render/av/col/edit/render.ts", "utf8");
        const cellSource = readFileSync("src/protyle/render/av/cell/render.helpers.ts", "utf8");
        const rollupSource = readFileSync("src/protyle/render/av/cell/renderRollup.ts", "utf8");
        const selectSource = readFileSync("src/protyle/render/av/select.ts", "utf8");
        const blockAttrSource = readFileSync("src/protyle/render/av/blockAttr.ts", "utf8");

        expect(addSource).toContain('data-icon="${escapeAttr(params.icon || "")}"');
        expect(addSource).toContain("${escapeHtml(params.name)}");
        expect(editSource).toContain('data-icon="${escapeAttr(colData.icon)}"');
        expect(cellSource).toContain('data-unicode="${escapeAttr(cellValue.block?.icon || "")}"');
        expect(rollupSource).toContain('data-unicode="${escapeAttr(blockIcon)}"');
        expect(selectSource).toContain('data-name="${escapeAttr(key)}"');
        expect(blockAttrSource).toContain('${escapeHtml(table.avName || siyuanI18n.database)}');
    });
});
