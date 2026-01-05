/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ref } from "vue";

// @织: 浏览器能够安全处理的最大CSS高度 (一个比较保守的值)
export const MAX_BROWSER_HEIGHT = 15_000_000;

// --- 类型定义 ---

// @织: 移除 style, 让 layout item 成为纯数据对象
export interface LayoutItem {
    id: any;
    data: any;
    isPlaceholder?: boolean;
    index: number;
    columnIndex: number;
    indexInColumn: number;
    width: number;
    height: number;
    x: number;
    y: number;
    // R-tree 需要的属性
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface LayoutColumn {
    height: number;
    items: LayoutItem[];
}

export interface UseLayoutEngineOptions {
    containerWidth: Ref<number>;
    columnWidth: Ref<number>;
    rowHeight: Ref<number>;
    gap: Ref<number>;
    items: Ref<any[]>;
    isScrolling: Ref<boolean>;
    idKey: string;
    itemHeight?: (itemData: any, columnWidth?: number) => number;
    estimatedTotalCount?: Ref<number | undefined>;
    mode?: "masonry" | "grid" | "justified" | "list";
    // 布局重建前的回调
    onBeforeRebuildLayout?: () => void;
    // 布局重建后的回调
    onAfterRebuildLayout?: () => void;
}

// @织: BushItem 不再需要是响应式的，它只是 R-Tree 的数据载体
export class BushItem implements LayoutItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: any;
    data: any;
    isPlaceholder?: boolean;
    index: number;
    columnIndex: number;
    indexInColumn: number;
    width: number;
    height: number;
    x: number;
    y: number;

    constructor(item: LayoutItem) {
        this.id = item.id;
        this.data = item.data;
        this.isPlaceholder = item.isPlaceholder;
        this.index = item.index;
        this.columnIndex = item.columnIndex;
        this.indexInColumn = item.indexInColumn;
        this.width = item.width;
        this.height = item.height;
        this.x = item.x;
        this.y = item.y;
        this.minX = item.x;
        this.minY = item.y;
        this.maxX = item.x + item.width;
        this.maxY = item.y + item.height;
    }
}

export interface LayoutEngineResult {
    allItems: Ref<LayoutItem[]>;
    totalHeight: Ref<number>;
    logicalScrollHeight: Ref<number>; 
    contentHeight: Ref<number>;
    columnCount: Ref<number>;
    updateItemHeight: (id: any, height: number) => void;
    rebuildLayout: () => void;
    findVisibleItems: (viewport: { top: number, height: number }) => LayoutItem[];
    layoutUpdateStamp: Ref<number>;
} 