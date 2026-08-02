import { describe, expect, it } from "vitest";
import { findListVisibleItems } from "../../src/components/masonry/composables/layout-engines/list/list-utils";
import type { LayoutItem } from "../../src/components/masonry/composables/layout-engines/types";

function createListItem(id: string, y: number, height: number, index: number): LayoutItem {
    return {
        id,
        data: { id },
        index,
        columnIndex: 0,
        indexInColumn: index,
        width: 320,
        height,
        x: 0,
        y,
        minX: 0,
        minY: y,
        maxX: 320,
        maxY: y + height,
    };
}

describe("VirtualMasonryGrid visible range", () => {
    it("向下滚动时应保留仍覆盖视口的高卡片", () => {
        const tall = createListItem("tall", 0, 1000, 0);
        const next = createListItem("next", 1010, 120, 1);

        const visible = findListVisibleItems({
            sortedItems: [tall, next],
            viewport: { top: 800, height: 180 },
            containerWidth: 320,
        });

        expect(visible.map((item) => item.id)).toContain("tall");
        expect(visible.map((item) => item.id)).not.toContain("next");
    });
});
