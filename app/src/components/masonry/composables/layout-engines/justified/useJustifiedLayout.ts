/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, shallowRef, nextTick, watch } from "vue";
import RBush from "rbush";
import { 
    BushItem, 
    LayoutItem,
    UseLayoutEngineOptions, 
    LayoutEngineResult 
} from "../types";
import {
    calculateTotalHeight,
    createColumnCountComputed,
    createScrollHeightComputed,
    createContentHeightComputed,
    createUpdateScheduler
} from "../layoutUtils";
import {
    calculateJustifiedLayout,
    appendJustifiedItems,
    processJustifiedHeightUpdates,
    findJustifiedVisibleItems
} from "./justified-utils";
import { createSegmentTree, type SegmentTree } from "../../../utils/createSegmentTree";

// 默认宽高比
const DEFAULT_ASPECT_RATIO = 1; 

/**
 * 对齐布局引擎 - 处理不规则宽高的项目，每行填满容器宽度
 */
export function useJustifiedLayout({
    containerWidth,
    columnWidth,
    rowHeight,
    gap,
    items,
    isScrolling,
    idKey,
    itemHeight,
    estimatedTotalCount,
    onBeforeRebuildLayout,
    onAfterRebuildLayout,
}: Omit<UseLayoutEngineOptions, "mode">): LayoutEngineResult {
    // R-tree 用于高效的空间查询
    const tree = new RBush<BushItem>();
    
    // Justified 模式专属状态
    let idealWidths: number[] = [];
    let segmentTree: SegmentTree | null = null;
    const itemAspectRatios = new Map<any, number>();
    
    // 双重缓存 - 渲染层 (shallowRef)
    const allItems = shallowRef<LayoutItem[]>([]); 
    
    // 双重缓存 - 计算层 (普通对象)
    const idToItemMap = new Map<any, LayoutItem>();

    const pendingUpdates = new Map<number, number>();
    const layoutUpdateStamp = ref(Date.now());
    const totalHeight = ref(0);

    // 计算列数 (虽然justified模式不直接使用列数，但接口需要保持一致)
    const columnCount = createColumnCountComputed({ containerWidth, columnWidth });

    /**
     * 更新总高度计算
     */
    const updateTotalHeight = () => {
        totalHeight.value = calculateTotalHeight(
            [], // justified模式不使用columns
            allItems.value, 
            "justified", 
            estimatedTotalCount?.value
        );
    };

    /**
     * 分割行并布局 - 使用抽离的纯函数
     */
    const partitionAndLayoutLocal = (startIndex = 0) => {
        if (!segmentTree) {
return;
}

        // 使用抽离出的纯函数
        const { newLayoutItems, layoutComplete } = calculateJustifiedLayout({
            startIndex,
            items: items.value,
            containerWidth,
            rowHeight,
            gap,
            idealWidths,
            segmentTree,
            idKey,
            existingItems: allItems.value
        });

        if (!layoutComplete) {
return;
}

        // 更新布局
        allItems.value = newLayoutItems;
        idToItemMap.clear();
        newLayoutItems.forEach(item => {
            if (item) {
idToItemMap.set(item.id, item);
}
        });
        
        // 更新R-Tree
        tree.clear();
        const bushItems: BushItem[] = newLayoutItems.map(item => new BushItem(item));
        tree.load(bushItems);
        
        updateTotalHeight();
        layoutUpdateStamp.value = Date.now();
    };

    /**
     * 添加新项目到布局中 - 使用抽离的纯函数
     */
    const appendItemsLocal = (itemsToAppend: any[]) => {
        if (itemsToAppend.length === 0) {
return;
}

        // 使用抽离出的纯函数计算理想宽度
        const { newIdealWidths } = appendJustifiedItems({
            itemsToAppend,
            rowHeight,
            idKey,
            itemAspectRatios
        });

        // 更新状态
        idealWidths.push(...newIdealWidths);
        segmentTree = createSegmentTree(idealWidths);
        partitionAndLayoutLocal(0);
    };

    /**
     * 处理高度更新请求 - 使用抽离的纯函数
     */
    const processPendingUpdatesLocal = () => {
        if (pendingUpdates.size === 0) {
return;
}
        
        const updatesToProcess = new Map(pendingUpdates);
        pendingUpdates.clear();

        // 使用抽离出的纯函数处理高度更新
        const { 
            minChangedIndex, 
            updatedSegmentTree, 
            updatedIdealWidths,
            hasChanges
        } = processJustifiedHeightUpdates({
            pendingUpdates: updatesToProcess,
            idToItemMap,
            itemAspectRatios,
            segmentTree,
            idealWidths,
            rowHeight
        });
        
        // 更新状态
        segmentTree = updatedSegmentTree;
        idealWidths = updatedIdealWidths;
        
        if (hasChanges && minChangedIndex !== Infinity) {
            partitionAndLayoutLocal(minChangedIndex);
        }
    };

    // 创建更新调度器
    const scheduleProcessing = createUpdateScheduler(isScrolling, processPendingUpdatesLocal);

    /**
     * 更新项目高度
     */
    const updateItemHeight = (id: any, height: number) => {
        const item = idToItemMap.get(id);
        if (item && item.height === height) {
            return;
        }
        pendingUpdates.set(id, height);

        // 智能决策 - 如果不在滚动，就立即调度更新
        if (!isScrolling.value) {
            scheduleProcessing();
        }
    };

    // 计算逻辑滚动高度
    const logicalScrollHeight = createScrollHeightComputed(totalHeight, estimatedTotalCount, allItems.value);
    
    // 计算实际内容高度（考虑浏览器限制）
    const contentHeight = createContentHeightComputed(logicalScrollHeight);

    /**
     * 重建整个布局
     */
    const rebuildLayout = () => {
        // 在布局重建前执行回调函数
        if (onBeforeRebuildLayout) {
            onBeforeRebuildLayout();
        }

        tree.clear();
        idToItemMap.clear();
        allItems.value = [];
        totalHeight.value = 0;
        
        idealWidths = [];
        segmentTree = null;
        
        const existingItems = [...items.value];
        appendItemsLocal(existingItems);

        // 在布局重建后执行回调函数
        if (onAfterRebuildLayout) {
            nextTick(() => {
                onAfterRebuildLayout();
            });
        }
    };

    /**
     * 查找可见项目 - 使用抽离的纯函数
     */
    const findVisibleItems = (viewport: { top: number, height: number }): LayoutItem[] => {
        return findJustifiedVisibleItems({
            tree,
            viewport,
            containerWidth,
            allItems: allItems.value
        });
    };

    // 监听 items 数组变化需要特殊处理
    function setupItemsWatch() {
        let oldItemsLength = items.value.length;
        
        watch(items, (newItems) => {
            if (newItems.length > oldItemsLength) {
                // 这是加载了更多数据
                const itemsToAppend = newItems.slice(oldItemsLength);
                appendItemsLocal(itemsToAppend);
                oldItemsLength = newItems.length;
            } else {
                // 这是一个全新的数据集，或者发生了排序/删除等复杂变化
                rebuildLayout();
                oldItemsLength = newItems.length;
            }
        });
    }

    // 设置监听
    setupItemsWatch();

    return {
        allItems,
        totalHeight,
        logicalScrollHeight,
        contentHeight,
        columnCount,
        updateItemHeight,
        rebuildLayout,
        findVisibleItems,
        layoutUpdateStamp,
    };
} 