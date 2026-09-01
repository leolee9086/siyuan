import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";

// 14978: 数据库条目拖选支持度与 kanban 视口裁剪（c659f43997 + 978806609d）
// 验证 split 架构下 dragSelect 模块的语义与上游一致，兼顾严格 TS 与 S-Forge 拆分
describe("AV dragSelect wiring (14978)", () => {
    it("dragSelect supports table, gallery, kanban and clipRect", () => {
        const src = fs.readFileSync(new URL("./dragSelect.ts", import.meta.url), "utf-8");
        // 上游 c659 扩展支持至 gallery, 978 加入 kanban
        assert.match(src, /\["table",\s*"kanban",\s*"gallery"\]/);
        assert.match(src, /clipRect.*kanban/);
        assert.match(src, /isRectIntersecting.*clipRect/);
        assert.match(src, /isAVDragSelectSupported/);
        assert.match(src, /applyAVDragSelection/);
        assert.match(src, /clearAVDragSelection/);
    });
    it("wysiwyg dragSelect lifecycle wires AV selection exactly as upstream", () => {
        const wysiwygSrc = fs.readFileSync(new URL("../../wysiwyg/index.mousedown.dragSelect.ts", import.meta.url), "utf-8");
        assert.match(wysiwygSrc, /isAVDragSelectSupported/);
        assert.match(wysiwygSrc, /applyAVDragSelection/);
        assert.match(wysiwygSrc, /clearAVDragSelection/);
        assert.match(wysiwygSrc, /avDragSelectElement/);
        assert.match(wysiwygSrc, /avDragSelectRange/);
        assert.match(wysiwygSrc, /avDragSelectMode/);
        assert.match(wysiwygSrc, /scheduleAVDragSelect/);
        assert.match(wysiwygSrc, /flushAVDragSelect/);
        // 保留 S-Forge 严格 TS 与 PointerNone 清理
        assert.match(wysiwygSrc, /fn__pointer-none/);
    });
});
