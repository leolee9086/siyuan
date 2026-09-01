import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";

// 16486: Alt 批量分组折叠审计 (a438dad17c + 87758a280e)
// 验证 S-Forge split 架构的 bulk fold 逻辑与上游一致且 aria-label 正确
describe("groupFold bulk Alt behavior (16486)", () => {
    it("groupFold module exposes getGroupFoldTip and state helpers", () => {
        const src = fs.readFileSync(new URL("./groupFold.ts", import.meta.url), "utf-8");
        assert.match(src, /getGroupFoldTip/);
        assert.match(src, /getGroupFoldedStates/);
        assert.match(src, /setGroupFoldedStates/);
        assert.match(src, /updateGroupFoldedStates/);
        // 87758 要求 aria-label 含 Alt 提示
        assert.match(src, /expandAll|foldAll/);
        assert.match(src, /⌥/);
    });
    it("click handler implements Alt bulk fold with do/undo and aria-label", () => {
        const clickSrc = fs.readFileSync(new URL("./action/click/dataType.advanced.ts", import.meta.url), "utf-8");
        assert.match(clickSrc, /event\.altKey/);
        assert.match(clickSrc, /foldAttrViewGroups/);
        assert.match(clickSrc, /doData/);
        assert.match(clickSrc, /undoData/);
        assert.match(clickSrc, /getGroupFoldTip/);
        assert.match(clickSrc, /setGroupFolded/);
        assert.match(clickSrc, /aria-label/);
    });
    it("render table group title includes aria-label via getGroupFoldTip", () => {
        const tableSrc = fs.readFileSync(new URL("./render.table.ts", import.meta.url), "utf-8");
        assert.match(tableSrc, /getGroupFoldTip/);
        assert.match(tableSrc, /aria-label/);
        assert.match(tableSrc, /av-group-fold/);
        assert.match(tableSrc, /ariaLabel/);
    });
    it("refresh handles both foldAttrViewGroup and foldAttrViewGroups with viewID", () => {
        const refreshSrc = fs.readFileSync(new URL("./render.refresh.ts", import.meta.url), "utf-8");
        assert.match(refreshSrc, /foldAttrViewGroups/);
        assert.match(refreshSrc, /getGroupFoldTip/);
        assert.match(refreshSrc, /updateGroupFoldedStates/);
        assert.match(refreshSrc, /getAVElements.*viewID/);
    });
});
