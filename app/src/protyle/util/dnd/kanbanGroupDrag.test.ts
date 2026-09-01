import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";

// 16325: 看板分组拖拽 (d46a46c87a 系列) — 验证排序标识与 S-Forge split 接线
// 16361: 过滤提示上下文 (c35f32684d) — 验证 viewID + filteredTip 跨 gutter/dnd
describe("kanban group drag wiring (16325)", () => {
    it("defines KANBAN lowercased prefix and uses dragover__left/right", () => {
        const overSrc = fs.readFileSync(new URL("./onDragOver.ts", import.meta.url), "utf-8");
        assert.match(overSrc, /dragover__left/);
        assert.match(overSrc, /dragover__right/);
        assert.match(overSrc, /--b3-av-kanban-drag-height/);
        assert.match(overSrc, /cleanupKanbanGroupDragover/);
        const startSrc = fs.readFileSync(new URL("./onDragStart.ts", import.meta.url), "utf-8");
        assert.match(startSrc, /av__group-title/);
        assert.match(startSrc, /Group/);
        assert.match(startSrc, /setDragImage/);
    });
    it("onDrop routing handles kanban group via sortAttrViewGroup", () => {
        const routingSrc = fs.readFileSync(new URL("./onDrop.helper.routing.ts", import.meta.url), "utf-8");
        assert.match(routingSrc, /KANBAN_GROUP_DRAG_TYPE/);
        assert.match(routingSrc, /sortAttrViewGroup/);
        assert.match(routingSrc, /setAttrViewGroup/);
        assert.match(routingSrc, /dragover__left/);
    });
    it("touch bridge long-press gate includes av__group-title", () => {
        const touchSrc = fs.readFileSync(new URL("../../../util/touchDragBridge.ts", import.meta.url), "utf-8");
        assert.match(touchSrc, /av__group-title/);
        assert.match(touchSrc, /requireLongPress/);
    });
    it("globalEvent scroll handling for kanban dragover x axis", () => {
        const eventSrc = fs.readFileSync(new URL("../../../boot/globalEvent/event.ts", import.meta.url), "utf-8");
        assert.match(eventSrc, /KANBAN_GROUP_DRAG_TYPE/);
        assert.match(eventSrc, /dragOverScroll/);
        assert.match(eventSrc, /av__kanban/);
    });
});

describe("filteredTip context via gutter/dnd (16361)", () => {
    it("avDrop and gutter insert include viewID and filteredTip context", () => {
        const avDropSrc = fs.readFileSync(new URL("./onDrop.helper.avDrop.ts", import.meta.url), "utf-8");
        assert.match(avDropSrc, /getAVViewID/);
        assert.match(avDropSrc, /getAVFilteredTipContext/);
        assert.match(avDropSrc, /viewID:/);
        assert.match(avDropSrc, /context: getAVFilteredTipContext/);
        const gutterSrc = fs.readFileSync(new URL("../../gutter/bindEvent.ts", import.meta.url), "utf-8");
        assert.match(gutterSrc, /getAVViewID/);
        assert.match(gutterSrc, /getAVFilteredTipContext\("target"/);
        assert.match(gutterSrc, /viewID: getAVViewID/);
        const insertSrc = fs.readFileSync(new URL("../insertHTML.ts", import.meta.url), "utf-8");
        assert.match(insertSrc, /getAVFilteredTipContext/);
        assert.match(insertSrc, /viewID:/);
    });
    it("row insert preserves target scope with openFilteredItem true", () => {
        const rowSrc = fs.readFileSync(new URL("../../render/av/row.ts", import.meta.url), "utf-8");
        assert.match(rowSrc, /getAVFilteredTipContext\("target", options\.protyle, true\)/);
    });
});
