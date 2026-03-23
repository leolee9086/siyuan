 
import { ref, computed, watch, Ref } from "vue";
import type { LayoutItem } from "./layout-engines/types";

/**
 * 虚拟化计算器的选项
 */
export interface UseVirtualizationOptions {
    allItems: Ref<LayoutItem[]>;
    scrollTop: Ref<number>;
    containerHeight: Ref<number>;
    overscanBy?: number;
    findVisibleItems?: (viewport: { top: number; height: number }) => LayoutItem[];
}

/**
 * 纯计算的虚拟化 Composable.
 * 它不执行任何 DOM 操作或事件监听，只根据输入的滚动位置和容器高度，
 * 计算出应该被渲染的可见项。
 */
export function useVirtualization({
    allItems,
    scrollTop,
    containerHeight,
    overscanBy = 2,
    findVisibleItems,
}: UseVirtualizationOptions) {
    const visibleItems = ref<LayoutItem[]>([]);

    const overscan = computed(() => overscanBy * containerHeight.value);

    const computeVisibleItems = () => {
        const viewportTop = scrollTop.value - overscan.value;
        const viewportHeight = containerHeight.value + overscan.value * 2;
        const newVisibleItems = findVisibleItems
            ? findVisibleItems({
                top: viewportTop,
                height: viewportHeight,
            })
            : allItems.value.filter(item =>
                item.y + item.height > viewportTop
                && item.y < viewportTop + viewportHeight
            );
        
        visibleItems.value = newVisibleItems;
    };

    // 监听所有相关依赖，自动重新计算
    watch([allItems, scrollTop, containerHeight], computeVisibleItems, {
        immediate: true, // 确保初始加载时执行
        deep: false // allItems 是 shallowRef，我们只关心它的替换
    });

    return {
        visibleItems,
        forceUpdate: computeVisibleItems, // forceUpdate 仍然可以作为手动触发的手段
    };
} 
