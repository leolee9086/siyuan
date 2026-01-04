/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, reactive, computed, Ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import RBush from 'rbush';
import { createRafScheduler } from '../utils/createRafScheduler';

// @织: 浏览器能够安全处理的最大CSS高度 (一个比较保守的值)
const MAX_BROWSER_HEIGHT = 15_000_000;

// --- 类型定义 ---

// @织: 移除 style, 让 layout item 成为纯数据对象
export interface LayoutItem {
    id: any;
    data: any;
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

export interface UseMasonryLayoutOptions {
    containerWidth: Ref<number>;
    columnWidth: Ref<number>;
    gap: Ref<number>;
    items: Ref<any[]>;
    idKey: string;
    itemHeight?: (itemData: any, columnWidth: number) => number;
    estimatedTotalCount?: Ref<number | undefined>;
}

// @织: BushItem 不再需要是响应式的，它只是 R-Tree 的数据载体
class BushItem implements LayoutItem {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: any;
    data: any;
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


/**
 * 一个管理瀑布流布局计算的 Vue Composable.
 * 使用 R-tree 优化空间查询和双重缓存机制优化更新性能.
 */
export function useMasonryLayout({ containerWidth, columnWidth, gap, items, idKey, itemHeight, estimatedTotalCount }: UseMasonryLayoutOptions) {
    const tree = new RBush<BushItem>();
    
    // @织: 双重缓存 - 渲染层 (shallowRef)
    // 只在批处理更新完成后整体替换，以触发一次性的、高效的视图更新
    const allItems = shallowRef<LayoutItem[]>([]); 
    
    // @织: 双重缓存 - 计算层 (普通对象)
    // @织: 关键性能优化：将 columns 从 ref 改造为普通数组，避免在计算循环中产生响应式开销
    const idToItemMap = new Map<any, LayoutItem>();
    let columns: LayoutColumn[] = [];

    const pendingUpdates = new Map<number, number>();
    const layoutUpdateStamp = ref(Date.now());

    // @织: 将 totalHeight 从 computed 改为 ref，手动更新
    const totalHeight = ref(0);

    const columnCount = computed(() => {
        if (!containerWidth.value || !columnWidth.value) return 1;
        return Math.max(1, Math.floor(containerWidth.value / columnWidth.value));
    });

    const initializeColumns = () => {
        columns = Array.from({ length: columnCount.value }, () => ({ height: 0, items: [] }));
    };

    const getShortestColumn = (): { index: number; height: number } => {
        let shortest = { index: -1, height: Infinity };
        columns.forEach((col, index) => {
            if (col.height < shortest.height) {
                shortest = { index, height: col.height };
            }
        });
        return shortest;
    };

    const updateTotalHeight = () => {
        if (columns.length === 0) {
            totalHeight.value = 0;
        } else {
            totalHeight.value = Math.max(...columns.map(c => c.height));
        }
    };

    const processPendingUpdates = () => {
        if (pendingUpdates.size === 0) {
            return;
        }

        const updatesToProcess = new Map(pendingUpdates);
        pendingUpdates.clear();

        const changedColumns = new Map<number, number>(); // <columnIndex, minChangedIndexInColumn>

        updatesToProcess.forEach((height, id) => {
            const item = idToItemMap.get(id);
            if (!item) return;

            const oldHeight = item.height;
            if (oldHeight === height) return;

            item.height = height;

            const columnIndex = item.columnIndex;
            if (columnIndex !== undefined) {
                const itemIndexInColumn = item.indexInColumn;
                const currentMin = changedColumns.get(columnIndex);
                if (currentMin === undefined || itemIndexInColumn < currentMin) {
                    changedColumns.set(columnIndex, itemIndexInColumn);
                }
            }
        });

        if (changedColumns.size > 0) {
            changedColumns.forEach((minChangedIndexInColumn, columnIndex) => {
                const column = columns[columnIndex];
                if (!column) return;

                // Start from the first changed item in the column
                const startItem = column.items[minChangedIndexInColumn];
                let currentY = startItem.y;

                // Recalculate positions for all items from the first changed one
                for (let i = minChangedIndexInColumn; i < column.items.length; i++) {
                    const item = column.items[i];
                    item.y = currentY;
                    currentY += item.height + (gap?.value ?? 0);
                }
                column.height = currentY - (gap?.value ?? 0);
            });

            // @织: 所有列计算完毕后，手动更新总高度
            updateTotalHeight();
            layoutUpdateStamp.value = Date.now();
        }
    };

    const scheduleProcessing = createRafScheduler(processPendingUpdates);

    const updateItemHeight = (id: any, height: number) => {
        const item = idToItemMap.get(id);
        if (item && item.height === height) {
            return;
        }
        pendingUpdates.set(id, height);
        scheduleProcessing();
    };

    const logicalScrollHeight = computed(() => {
        const estimatedCount = estimatedTotalCount?.value;
        const currentItemCount = allItems.value.length;

        if (estimatedCount && estimatedCount > currentItemCount) {
            const currentTotalHeight = totalHeight.value;
            // 如果还没有任何项，使用列宽作为估算的初始高度
            const avgHeight = currentItemCount > 0 
                ? currentTotalHeight / currentItemCount 
                : columnWidth.value;
            
            return avgHeight * estimatedCount;
        }
        return totalHeight.value;
    });

    const contentHeight = computed(() => {
        return Math.min(logicalScrollHeight.value, MAX_BROWSER_HEIGHT);
    });

    // @织: 将 rebuildLayout 拆分为完全重建和增量添加
    const appendItems = (itemsToAppend: any[]) => {
        if (itemsToAppend.length === 0) return;

        const newLayoutItems: LayoutItem[] = [];
        const newBushItems: BushItem[] = [];

        itemsToAppend.forEach(itemData => {
            const id = itemData[idKey];
            // 防止重复添加
            if (idToItemMap.has(id)) return;

            const shortestColumn = getShortestColumn();
            const columnIndex = shortestColumn.index;
            
            const newItem: LayoutItem = {
                id,
                data: itemData,
                index: allItems.value.length + newLayoutItems.length,
                columnIndex,
                indexInColumn: columns[columnIndex].items.length,
                width: columnWidth.value,
                height: itemHeight ? itemHeight(itemData, columnWidth.value) : columnWidth.value,
                x: columnIndex * (columnWidth.value + gap.value),
                y: shortestColumn.height,
                minX: 0, minY: 0, maxX: 0, maxY: 0 // 将在 BushItem 中计算
            };
            
            columns[columnIndex].items.push(newItem);
            columns[columnIndex].height += newItem.height + gap.value;
            idToItemMap.set(id, newItem);
            
            newBushItems.push(new BushItem(newItem));
            newLayoutItems.push(newItem);
        });

        // @织: 批量更新
        if (newLayoutItems.length > 0) {
            tree.load(newBushItems);
            allItems.value = [...allItems.value, ...newLayoutItems];
            updateTotalHeight(); // 手动更新总高度
            layoutUpdateStamp.value = Date.now();
        }
    };
    
    const rebuildLayout = () => {
        initializeColumns();
        tree.clear();
        idToItemMap.clear();
        allItems.value = [];
        appendItems(items.value);
    };

    // @织: 关键! 监听外部 items 数组的变化
    watch(items, (newItems, oldItems) => {
        if (newItems.length > oldItems.length) {
            // 这是加载了更多数据
            const itemsToAppend = newItems.slice(oldItems.length);
            appendItems(itemsToAppend);
        } else if (newItems.length < oldItems.length || newItems.some((item, i) => item[idKey] !== oldItems[i]?.[idKey])) {
            // 这是一个全新的数据集，或者发生了排序/删除等复杂变化
            rebuildLayout();
        }
    });

    const findVisibleItems = (viewport: { top: number, height: number }): LayoutItem[] => {
        const results = tree.search({
            minX: 0,
            minY: viewport.top,
            maxX: containerWidth.value,
            maxY: viewport.top + viewport.height,
        });
        // @织: 从 R-Tree 拿到 ID，再从 allItems 中获取最新的响应式对象
        const visibleIds = new Set(results.map(r => r.id));
        return allItems.value.filter(item => visibleIds.has(item.id));
    }

    initializeColumns();

    onMounted(() => {
        // ... existing code ...
    });

    onUnmounted(() => {
        scheduleProcessing.cancel();
    });

    return {
        // @织: 不再直接暴露 layoutItems，而是通过 allItems 这个 shallowRef
        allItems,
        totalHeight,
        logicalScrollHeight, // <-- 修改这里
        contentHeight,       // <-- 新增这里
        columnCount,         // @织: 之前的修改好像把这个弄丢了，它应该在
        updateItemHeight,
        rebuildLayout,
        findVisibleItems,
        layoutUpdateStamp,
    };
} 