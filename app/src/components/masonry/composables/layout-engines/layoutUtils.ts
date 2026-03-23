import { computed, ref, Ref, watch, ComputedRef } from "vue";
import { createRafScheduler } from "../../utils/createRafScheduler";
import type { LayoutColumn, LayoutItem, UseLayoutEngineOptions } from "./types";
import { MAX_BROWSER_HEIGHT } from "./types";

/**
 * 初始化列数据结构
 */
export function initializeColumns(columnCount: number): LayoutColumn[] {
    return Array.from({ length: columnCount }, () => ({ height: 0, items: [] }));
}

/**
 * 查找最短的列
 */
export function getShortestColumn(columns: LayoutColumn[]): { index: number; height: number } {
    let shortest = { index: -1, height: Infinity };
    columns.forEach((col, index) => {
        if (col.height < shortest.height) {
            shortest = { index, height: col.height };
        }
    });
    return shortest;
}

/**
 * 计算并更新总高度
 */
export function calculateTotalHeight(
    columns: LayoutColumn[], 
    allItems: LayoutItem[], 
    mode: "masonry" | "grid" | "justified",
    estimatedTotalCount?: number
): number {
    if (columns.length === 0 && mode === "masonry") {
        return 0;
    }

    let calculatedHeight = 0;

    if (mode === "grid" || mode === "justified") {
        const lastItem = allItems[allItems.length - 1];
        if (lastItem) {
            calculatedHeight = lastItem.y + lastItem.height;
        }
    } else { // masonry
        calculatedHeight = Math.max(...columns.map(c => c.height));
    }
    
    // 如果有估算的总项目数，根据已知项目的平均高度估算总高度
    if (estimatedTotalCount && estimatedTotalCount > allItems.length && allItems.length > 0) {
        const avgHeight = calculatedHeight / allItems.length;
        const estimatedHeight = avgHeight * estimatedTotalCount;
        calculatedHeight = Math.max(calculatedHeight, estimatedHeight);
    }
    
    // 限制最大高度，防止浏览器渲染问题
    return Math.min(calculatedHeight, MAX_BROWSER_HEIGHT);
}

/**
 * 创建计算列数的计算属性
 */
export function createColumnCountComputed({ containerWidth, columnWidth }: Pick<UseLayoutEngineOptions, "containerWidth" | "columnWidth">): ComputedRef<number> {
    return computed(() => {
        if (!containerWidth.value || !columnWidth.value) {
return 1;
}
        return Math.max(1, Math.floor(containerWidth.value / columnWidth.value));
    });
}

/**
 * 创建滚动高度计算的计算属性
 */
export function createScrollHeightComputed(
    totalHeight: Ref<number>, 
    estimatedTotalCount: UseLayoutEngineOptions["estimatedTotalCount"], 
    allItems: LayoutItem[]
): ComputedRef<number> {
    return computed(() => {
        const estimatedCount = estimatedTotalCount?.value;
        const currentItemCount = allItems.length;

        if (estimatedCount && estimatedCount > currentItemCount) {
            // 这里totalHeight一定有值，因为它是一个Ref<number>
            const currentTotalHeight = totalHeight.value;
            // 如果还没有任何项，使用固定值作为估算的初始高度
            const avgHeight = currentItemCount > 0 
                ? currentTotalHeight / currentItemCount 
                : 100; // 默认值
            
            return avgHeight * estimatedCount;
        }
        return totalHeight.value;
    });
}

/**
 * 创建内容高度的计算属性（考虑浏览器限制）
 */
export function createContentHeightComputed(logicalScrollHeight: ComputedRef<number>): ComputedRef<number> {
    return computed(() => {
        return Math.min(logicalScrollHeight.value, MAX_BROWSER_HEIGHT);
    });
}

/**
 * 创建对items监听的逻辑
 */
export function setupItemsWatch(
    items: UseLayoutEngineOptions["items"], 
    appendItems: (itemsToAppend: any[]) => void, 
    rebuildLayout: () => void,
    idKey: string
) {
    watch(items, (newItems, oldItems) => {
        if (newItems.length > oldItems.length) {
            const isPureAppend = oldItems.every((item, index) => item[idKey] === newItems[index]?.[idKey]);
            if (isPureAppend) {
                // 这是加载了更多数据
                const itemsToAppend = newItems.slice(oldItems.length);
                appendItems(itemsToAppend);
                return;
            }
            // 尾部占位项被真实数据顶替等场景会改变既有索引上的 id，此时必须整体重建，避免重复项残留。
            rebuildLayout();
        } else if (newItems.length < oldItems.length || newItems.some((item, i) => item[idKey] !== oldItems[i]?.[idKey])) {
            // 这是一个全新的数据集，或者发生了排序/删除等复杂变化
            rebuildLayout();
        }
    });
}

/**
 * 创建智能更新调度器
 */
export function createUpdateScheduler(isScrolling: UseLayoutEngineOptions["isScrolling"], processPendingUpdates: () => void) {
    const scheduleProcessing = createRafScheduler(processPendingUpdates);
    
    // 监听滚动状态
    watch(isScrolling, (scrolling) => {
        // 当滚动停止时
        if (!scrolling) {
            // 稍作等待，让惯性滚动结束
            setTimeout(() => {
                scheduleProcessing();
            }, 100); // 100ms 的冷却时间
        }
    });    
    
    return scheduleProcessing;
} 
