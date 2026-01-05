/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, shallowRef, watch, type Ref } from "vue";

/**
 * @织: 定义数据项的基本结构，必须包含一个唯一的 id
 */
export interface DataItem {
    id: string | number;
    [key: string]: any;
}

/**
 * @织: 定义占位符的结构
 * isPlaceholder 标记可以让UI组件区分真实数据和占位符
 */
export interface Placeholder {
    id: string;
    isPlaceholder: true;
    index: number;
}

/**
 * @织: 数据获取器函数的类型定义
 * 接收一个不连续的索引数组，返回一个Promise，该Promise解析为数据项数组
 */
export type DataFetcher = (indices: number[]) => Promise<DataItem[]>;

/**
 * @织: useVirtualDataSource 的选项接口
 */
export interface UseVirtualDataSourceOptions {
    totalCount: Ref<number>;
    dataFetcher: DataFetcher;
    initialPageSize?: number; // 初始加载的数据量
    createPlaceholder?: (index: number) => any; // 自定义占位符创建函数
}

/**
 * 默认的占位符创建函数
 * @param {number} index - 占位符的索引位置
 * @returns {Placeholder} 返回一个标准的占位符对象
 * @example
 * ```typescript
 * const placeholder = defaultCreatePlaceholder(0);
 * // 返回: { id: 'placeholder-0', isPlaceholder: true, index: 0 }
 * ```
 */
const defaultCreatePlaceholder = (index: number): Placeholder => ({
    id: `placeholder-${index}`,
    isPlaceholder: true,
    index,
});

/**
 * 将获取的数据映射到索引，提高查找效率
 * @param {DataItem[]} fetchedData - 获取到的数据项数组
 * @returns {Map<number, DataItem>} 返回索引到数据项的映射
 * @example
 * ```typescript
 * const data = [{ id: '1', index: 0 }, { id: '2', index: 1 }];
 * const dataMap = createDataMap(data);
 * // 返回: Map { 0 => { id: '1', index: 0 }, 1 => { id: '2', index: 1 } }
 * ```
 */
const createDataMap = (fetchedData: DataItem[]): Map<number, DataItem> => {
    return new Map(fetchedData.map(d => [d.index, d]));
};

/**
 * 处理单个索引的数据替换逻辑
 * @param {number} index - 要处理的索引
 * @param {Map<number, DataItem>} dataMap - 数据映射表
 * @param {any[]} newItems - 要更新的项目数组
 * @returns {boolean} 如果成功替换了占位符返回true，否则返回false
 * @example
 * ```typescript
 * const dataMap = new Map([[0, { id: '1', index: 0 }]]);
 * const items = [{ isPlaceholder: true, index: 0 }];
 * const replaced = processSingleIndexReplacement(0, dataMap, items);
 * // 返回: true，items[0] 被替换为真实数据
 * ```
 */
const processSingleIndexReplacement = (
    index: number,
    dataMap: Map<number, DataItem>,
    newItems: any[]
): boolean => {
    const dataForItem = dataMap.get(index);
    if (dataForItem) {
        const itemToReplace = newItems[index];
        if (itemToReplace && itemToReplace.isPlaceholder) {
            newItems[index] = dataForItem;
            return true;
        }
    }
    return false;
};

/**
 * 用真实数据替换占位符
 * @param {any[]} items - 当前的项目数组
 * @param {number[]} indicesToRequest - 要请求的索引数组
 * @param {Map<number, DataItem>} dataMap - 数据映射表
 * @returns {{ newItems: any[], replaced: boolean }} 返回新的项目数组和是否发生替换的标志
 * @example
 * ```typescript
 * const items = [{ isPlaceholder: true, index: 0 }, { isPlaceholder: true, index: 1 }];
 * const indices = [0, 1];
 * const dataMap = new Map([[0, { id: '1', index: 0 }], [1, { id: '2', index: 1 }]]);
 * const result = replacePlaceholdersWithData(items, indices, dataMap);
 * // result.newItems 包含真实数据，result.replaced 为 true
 * ```
 */
const replacePlaceholdersWithData = (
    items: any[],
    indicesToRequest: number[],
    dataMap: Map<number, DataItem>
): { newItems: any[]; replaced: boolean } => {
    const newItems = [...items];
    let replaced = false;

    indicesToRequest.forEach(index => {
        const wasReplaced = processSingleIndexReplacement(index, dataMap, newItems);
        if (wasReplaced) {
            replaced = true;
        }
    });

    return { newItems, replaced };
};

/**
 * 创建数据请求函数
 * @param {DataFetcher} dataFetcher - 数据获取器函数
 * @param {Ref<any[]>} items - 响应式的项目数组
 * @param {Ref<boolean>} isFetching - 响应式的获取状态标志
 * @param {Set<number>} requestedIndices - 已请求索引的集合
 * @returns {(indices: number[]) => Promise<DataItem[]>} 返回一个异步函数，用于请求指定索引的数据
 * @example
 * ```typescript
 * const requestData = createRequestDataForRange(dataFetcher, items, isFetching, requestedIndices);
 * const result = await requestData([0, 1, 2]);
 * // 请求索引 0, 1, 2 的数据，并更新 items 中的占位符
 * ```
 */
const createRequestDataForRange = (
    dataFetcher: DataFetcher,
    items: Ref<any[]>,
    isFetching: Ref<boolean>,
    requestedIndices: Set<number>
) => {
    return async (indices: number[]) => {
        if (isFetching.value) {
return [];
}

        const indicesToRequest = indices.filter(index => !requestedIndices.has(index));
        
        if (indicesToRequest.length === 0) {
            return []; // @织: 返回空数组，表示没有获取新数据
        }

        try {
            isFetching.value = true;
            // @织: 立即将索引标记为"已请求"，防止并发调用时重复请求相同的索引
            indicesToRequest.forEach(index => requestedIndices.add(index));

            const fetchedData = await dataFetcher(indicesToRequest);
            const dataMap = createDataMap(fetchedData);
            const { newItems, replaced } = replacePlaceholdersWithData(items.value, indicesToRequest, dataMap);

            if (replaced) {
                items.value = newItems;
            }
            return fetchedData; // @织: 返回获取到的新数据
        } catch (error) {
            handleFetchError(error, indicesToRequest, requestedIndices);
            return []; // @织: 失败时返回空数组
        } finally {
            isFetching.value = false;
        }
    };
};

/**
 * 创建初始化函数
 * @param {(index: number) => any} createPlaceholder - 占位符创建函数
 * @returns {(count: number) => any[]} 返回一个函数，用于初始化指定数量的占位符
 * @example
 * ```typescript
 * const initializeItems = createInitializeItems(defaultCreatePlaceholder);
 * const items = initializeItems(3);
 * // 返回包含3个占位符的数组
 * ```
 */
const createInitializeItems = (createPlaceholder: (index: number) => any) => {
    return (count: number) => {
        const initialItems: any[] = [];
        for (let i = 0; i < count; i++) {
            const placeholder = createPlaceholder(i);
            initialItems.push(placeholder);
        }
        return initialItems;
    };
};

/**
 * 创建初始数据加载函数
 * @param {number} initialPageSize - 初始页面大小
 * @param {(indices: number[]) => Promise<DataItem[]>} requestDataForRange - 数据请求函数
 * @returns {(count: number) => void} 返回一个函数，用于加载初始数据
 * @example
 * ```typescript
 * const loadInitialData = createInitialDataLoader(50, requestDataForRange);
 * loadInitialData(100);
 * // 加载前50条数据
 * ```
 */
const createInitialDataLoader = (
    initialPageSize: number,
    requestDataForRange: (indices: number[]) => Promise<DataItem[]>
) => {
    return (count: number) => {
        if (initialPageSize > 0 && count > 0) {
            const initialIndices = Array.from({ length: Math.min(initialPageSize, count) }, (_, i) => i);
            requestDataForRange(initialIndices);
        }
    };
};

/**
 * 处理数据请求失败的情况
 * @param {any} error - 请求失败的错误对象
 * @param {number[]} indicesToRequest - 请求失败的索引数组
 * @param {Set<number>} requestedIndices - 已请求索引的集合
 * @example
 * ```typescript
 * const indices = [0, 1, 2];
 * const requested = new Set([0, 1, 2]);
 * handleFetchError(new Error('Network error'), indices, requested);
 * // 从 requested 中移除所有失败的索引，允许后续重试
 * ```
 */
const handleFetchError = (error: any, indicesToRequest: number[], requestedIndices: Set<number>): void => {
    console.error("[useVirtualDataSource] Error fetching data:", error);
    // @织: 如果请求失败，需要将索引从 requestedIndices 中移除，以便后续可以重试
    indicesToRequest.forEach(index => requestedIndices.delete(index));
};

/**
 * 一个可扩展的、用于处理大规模虚拟数据源的组合式函数。
 * 它负责管理占位符、按需请求数据，并提供一个对UI透明的响应式数据列表。
 * 
 * @param {UseVirtualDataSourceOptions} options - 配置选项
 * @param {Ref<number>} options.totalCount - 数据总数量
 * @param {DataFetcher} options.dataFetcher - 数据获取器函数
 * @param {number} [options.initialPageSize=50] - 初始加载的数据量
 * @param {(index: number) => any} [options.createPlaceholder] - 自定义占位符创建函数
 * 
 * @returns {{
 *   items: Ref<any[]>,
 *   isFetching: Ref<boolean>,
 *   requestDataForRange: (indices: number[]) => Promise<DataItem[]>
 * }} 返回响应式的数据源对象
 * 
 * @example
 * ```typescript
 * const { items, isFetching, requestDataForRange } = useVirtualDataSource({
 *   totalCount: ref(1000),
 *   dataFetcher: async (indices) => {
 *     // 从服务器获取数据
 *     return indices.map(index => ({ id: `item-${index}`, index }));
 *   },
 *   initialPageSize: 20
 * });
 * 
 * // 监听数据变化
 * watch(items, (newItems) => {
 *   console.log('数据更新:', newItems);
 * });
 * 
 * // 手动请求特定范围的数据
 * await requestDataForRange([10, 11, 12, 13, 14]);
 * ```
 * 
 * @description
 * 这个组合式函数提供了以下功能：
 * 1. 自动管理占位符和真实数据的混合列表
 * 2. 防止重复请求相同的数据
 * 3. 支持并发请求控制
 * 4. 提供响应式的数据状态
 * 5. 支持自定义占位符创建逻辑
 * 6. 自动处理请求失败和重试机制
 */
export function useVirtualDataSource({
    totalCount,
    dataFetcher,
    initialPageSize = 50, // 默认初始加载50条
    createPlaceholder = defaultCreatePlaceholder,
}: UseVirtualDataSourceOptions) {

    // --- 内部状态 ---

    // 存储所有项（占位符或真实数据）的列表
    const items = shallowRef<any[]>([]);

    // 标记当前是否正在进行数据请求，防止并发请求
    const isFetching = ref(false);
    // 记录已经请求过的索引，避免重复请求
    const requestedIndices = new Set<number>();

    // --- 创建核心方法 ---

    const requestDataForRange = createRequestDataForRange(dataFetcher, items, isFetching, requestedIndices);
    const initializeItems = createInitializeItems(createPlaceholder);
    const loadInitialData = createInitialDataLoader(initialPageSize, requestDataForRange);

    // --- 初始化与响应式处理 ---
    // @织: 使用 watch 替换 watchEffect，明确指定依赖为 totalCount，避免不必要的重复执行。
    watch(totalCount, (count) => {
        // 当 totalCount 变化时，重置所有状态并重新生成列表
        items.value = initializeItems(count);

        requestedIndices.clear();
        isFetching.value = false;

        // 初始加载第一页数据
        loadInitialData(count);
    }, { immediate: true });

    // --- 暴露的 API ---
    return {
        items,
        isFetching,
        requestDataForRange,
    };
} 