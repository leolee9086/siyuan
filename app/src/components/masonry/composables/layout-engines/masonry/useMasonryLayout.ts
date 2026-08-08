/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, shallowRef, nextTick } from "vue";
import RBush from "rbush";
import { 
    BushItem, 
    LayoutItem, 
    LayoutColumn, 
    UseLayoutEngineOptions, 
    LayoutEngineResult 
} from "../types";
import {
    getShortestColumn,
    initializeColumns,
    calculateTotalHeight,
    createColumnCountComputed,
    createScrollHeightComputed,
    createContentHeightComputed,
    createUpdateScheduler,
    setupItemsWatch
} from "../layoutUtils";
import {
    appendMasonryItems,
    processMasonryHeightUpdates,
    findMasonryVisibleItems
} from "./masonry-utils";

/**
 * 瀑布流布局引擎 - 处理不规则高度的项目
 */
export function useMasonryLayout({
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
    
    // 双重缓存 - 渲染层 (shallowRef)
    const allItems = shallowRef<LayoutItem[]>([]); 
    
    // 双重缓存 - 计算层 (普通对象)
    const idToItemMap = new Map<any, LayoutItem>();
    let columns: LayoutColumn[] = [];

    const pendingUpdates = new Map<number, number>();
    const layoutUpdateStamp = ref(Date.now());
    const totalHeight = ref(0);

    // 高度变化会移动后续卡片；RBush 的边界也必须随布局一起重建，
    // 否则滚动到新位置时仍会按旧坐标裁剪可见项。
    const rebuildSpatialIndex = () => {
        tree.clear();
        if (allItems.value.length > 0) {
            tree.load(allItems.value.map(item => new BushItem(item)));
        }
    };

    // 计算列数
    const columnCount = createColumnCountComputed({ containerWidth, columnWidth });

    /**
     * 初始化列结构
     */
    const initializeColumnsLocal = () => {
        columns = initializeColumns(columnCount.value);
    };

    /**
     * 更新总高度计算
     */
    const updateTotalHeight = () => {
        totalHeight.value = calculateTotalHeight(
            columns, 
            allItems.value, 
            "masonry", 
            estimatedTotalCount?.value
        );
    };

    /**
     * 添加新项目到布局中 - 使用抽离的纯函数
     */
    const appendItemsLocal = (itemsToAppend: any[]) => {
        if (itemsToAppend.length === 0) {
return;
}

        // 使用抽离出的纯函数
        const { newLayoutItems, newBushItems, modifiedColumns } = appendMasonryItems({
            itemsToAppend,
            columnWidth,
            gap,
            idKey,
            itemHeight,
            columns,
            allItems: allItems.value,
            idToItemMap
        });

        // 批量更新
        if (newLayoutItems.length > 0) {
            // 更新列数据
            columns = modifiedColumns;
            
            // 更新ID映射
            newLayoutItems.forEach(item => {
                idToItemMap.set(item.id, item);
            });
            
            // 更新R-Tree和视图
            tree.load(newBushItems);
            allItems.value = [...allItems.value, ...newLayoutItems];
            updateTotalHeight(); // 手动更新总高度
            layoutUpdateStamp.value = Date.now();
        }
    };

    /**
     * 处理高度更新请求 - 使用抽离的纯函数
     */
    const processPendingUpdatesLocal = () => {
        if (pendingUpdates.size === 0) {
return;
}
        
        // 创建一个副本用于处理
        const updatesToProcess = new Map(pendingUpdates);
        pendingUpdates.clear();
        
        // 使用抽离出的纯函数
        const { updatedItems, updatedColumns, hasChanges } = processMasonryHeightUpdates({
            pendingUpdates: updatesToProcess,
            idToItemMap,
            allItems: allItems.value,
            columns,
            gap
        });

        // 如果有变化，更新状态
        if (hasChanges) {
            allItems.value = updatedItems;
            columns = updatedColumns;
            rebuildSpatialIndex();
            updateTotalHeight(); // 手动更新总高度
            layoutUpdateStamp.value = Date.now();
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
        const existingItems = [...items.value];
        allItems.value = [];
        
        initializeColumnsLocal();
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
        return findMasonryVisibleItems({
            tree,
            viewport,
            containerWidth,
            allItems: allItems.value
        });
    };

    // 监听 items 数组变化
    setupItemsWatch(items, appendItemsLocal, rebuildLayout, idKey);

    // 初始化列结构
    initializeColumnsLocal();

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
