/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, shallowRef, nextTick } from 'vue';
import RBush from 'rbush';
import { 
    LayoutItem, 
    BushItem, 
    UseLayoutEngineOptions, 
    LayoutEngineResult 
} from '../types';
import {
    initializeColumns,
    calculateTotalHeight,
    createColumnCountComputed,
    createScrollHeightComputed,
    createContentHeightComputed,
    createUpdateScheduler,
    setupItemsWatch
} from '../layoutUtils';
import {
    binarySearch,
    findItemsInYRange,
    createBushItems,
    calculateListLayout,
    appendListItems,
    processListHeightUpdates,
    findListVisibleItems,
    findItemsInSelectionBox
} from './list-utils';

/**
 * 列表布局引擎 - 使用混合策略优化性能
 * 结合二分查找（虚拟滚动）和 R-tree（选择框查询）
 */
export function useListLayout({
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
}: Omit<UseLayoutEngineOptions, 'mode'>): LayoutEngineResult {
    // R-tree 用于选择框查询
    const tree = new RBush<BushItem>();
    
    // 双重缓存 - 渲染层 (shallowRef)
    const allItems = shallowRef<LayoutItem[]>([]); 
    
    // 双重缓存 - 计算层 (普通对象)
    const idToItemMap = new Map<any, LayoutItem>();
    
    // 按 y 坐标排序的数组，用于虚拟滚动（二分查找）
    const sortedByY: LayoutItem[] = [];
    
    const pendingUpdates = new Map<number, number>();
    const layoutUpdateStamp = ref(Date.now());
    const totalHeight = ref(0);

    // 计算列数（列表模式下始终为1）
    const columnCount = ref(1);

    /**
     * 更新总高度计算
     */
    const updateTotalHeight = () => {
        // 列表模式：使用最后一个项目的位置计算总高度
        if (allItems.value.length === 0) {
            totalHeight.value = 0;
            return;
        }
        
        const lastItem = allItems.value[allItems.value.length - 1];
        let calculatedHeight = lastItem.y + lastItem.height;
        
        // 如果有估算的总项目数，根据已知项目的平均高度估算总高度
        if (estimatedTotalCount?.value && estimatedTotalCount.value > allItems.value.length) {
            const avgHeight = calculatedHeight / allItems.value.length;
            const estimatedHeight = avgHeight * estimatedTotalCount.value;
            calculatedHeight = Math.max(calculatedHeight, estimatedHeight);
        }
        
        totalHeight.value = Math.min(calculatedHeight, 15_000_000); // MAX_BROWSER_HEIGHT
    };

    /**
     * 更新排序数组
     */
    const updateSortedArray = () => {
        sortedByY.length = 0;
        sortedByY.push(...allItems.value.sort((a, b) => a.y - b.y));
    };

    /**
     * 添加新项目到布局中
     */
    const appendItemsLocal = (itemsToAppend: any[]) => {
        if (itemsToAppend.length === 0) return;

        // 使用列表布局算法
        const { newLayoutItems, newBushItems } = appendListItems({
            itemsToAppend,
            containerWidth: containerWidth.value,
            itemHeight: itemHeight ? (item) => itemHeight(item, containerWidth.value) : () => rowHeight.value,
            gap: gap.value,
            idKey,
            existingItems: allItems.value,
            idToItemMap
        });

        // 批量更新
        if (newLayoutItems.length > 0) {
            // 更新ID映射
            newLayoutItems.forEach(item => {
                idToItemMap.set(item.id, item);
            });
            
            // 更新R-Tree和视图
            tree.load(newBushItems);
            allItems.value = [...allItems.value, ...newLayoutItems];
            updateSortedArray(); // 更新排序数组
            updateTotalHeight();
            layoutUpdateStamp.value = Date.now();
        }
    };

    /**
     * 处理高度更新请求
     */
    const processPendingUpdatesLocal = () => {
        if (pendingUpdates.size === 0) return;
        
        // 创建一个副本用于处理
        const updatesToProcess = new Map(pendingUpdates);
        pendingUpdates.clear();
        
        // 使用列表布局的高度更新算法
        const { updatedItems, hasChanges } = processListHeightUpdates({
            pendingUpdates: updatesToProcess,
            idToItemMap,
            allItems: allItems.value,
            gap: gap.value
        });

        // 如果有变化，更新状态
        if (hasChanges) {
            allItems.value = updatedItems;
            updateSortedArray(); // 更新排序数组
            updateTotalHeight();
            layoutUpdateStamp.value = Date.now();
            
            // 重新构建 R-tree
            tree.clear();
            const bushItems = createBushItems(updatedItems);
            tree.load(bushItems);
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
        sortedByY.length = 0;
        
        // 使用列表布局算法重新计算
        const layoutItems = calculateListLayout(
            existingItems,
            containerWidth.value,
            itemHeight ? (item) => itemHeight(item, containerWidth.value) : () => rowHeight.value,
            gap.value,
            idKey
        );

        // 批量更新
        allItems.value = layoutItems;
        layoutItems.forEach(item => {
            idToItemMap.set(item.id, item);
        });
        
        // 更新排序数组和 R-tree
        updateSortedArray();
        const bushItems = createBushItems(layoutItems);
        tree.load(bushItems);
        updateTotalHeight();
        layoutUpdateStamp.value = Date.now();

        // 在布局重建后执行回调函数
        if (onAfterRebuildLayout) {
            nextTick(() => {
                onAfterRebuildLayout();
            });
        }
    };

    /**
     * 查找可见项目 - 使用二分查找优化
     */
    const findVisibleItems = (viewport: { top: number, height: number }): LayoutItem[] => {
        return findListVisibleItems({
            sortedItems: sortedByY,
            viewport,
            containerWidth: containerWidth.value
        });
    };

    // 设置项目监听
    setupItemsWatch(items, appendItemsLocal, rebuildLayout, idKey);

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