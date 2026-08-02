import { describe, expect, it } from "vitest";
import { captureVirtualMasonryScrollAnchor } from "../../src/components/masonry/components/VirtualMasonryGrid.scroll";
import { restoreVirtualMasonryScrollTop } from "../../src/components/masonry/components/VirtualMasonryGrid.scroll";

describe("VirtualMasonryGrid scroll coordinates", () => {
    it("内容高度变化时非底部阅读位置不应按比例来回跳动", () => {
        const anchor = captureVirtualMasonryScrollAnchor({
            scrollTop: 1200,
            scrollHeight: 3000,
            clientHeight: 500,
            followOutput: false,
            followThresholdPx: 96,
        });

        const afterGrowth = restoreVirtualMasonryScrollTop(anchor, {
            scrollHeight: 4200,
            clientHeight: 500,
        });
        const anchorAfterGrowth = captureVirtualMasonryScrollAnchor({
            scrollTop: afterGrowth,
            scrollHeight: 4200,
            clientHeight: 500,
            followOutput: false,
            followThresholdPx: 96,
        });
        const afterShrink = restoreVirtualMasonryScrollTop(anchorAfterGrowth, {
            scrollHeight: 3000,
            clientHeight: 500,
        });

        expect(afterGrowth).toBe(1200);
        expect(afterShrink).toBe(1200);
    });

    it("贴底输出模式应严格恢复到底部，而不是按滚动比例漂移", () => {
        const anchor = captureVirtualMasonryScrollAnchor({
            scrollTop: 2408,
            scrollHeight: 3000,
            clientHeight: 500,
            followOutput: true,
            followThresholdPx: 128,
        });

        expect(restoreVirtualMasonryScrollTop(anchor, {
            scrollHeight: 5200,
            clientHeight: 500,
        })).toBe(4700);
    });
});
