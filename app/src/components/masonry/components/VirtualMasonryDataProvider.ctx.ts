import { toRef, nextTick, type Ref } from "vue";
import { useVirtualDataSource } from "../composables/useVirtualDataSource";
import VirtualMasonryGrid from "./VirtualMasonryGrid.vue";
import type { VirtualMasonryDataProviderProps } from "./VirtualMasonryDataProvider.types";

/**
 * @function useVirtualMasonryDataProviderLogic
 * @description
 * 封装 VirtualMasonryDataProvider 的主要业务逻辑。
 * 负责管理虚拟滚动的数据源以及处理滚动结束后的数据加载和布局过渡控制。
 * 
 * @param props 组件 Props，必须包含 dataFetcher 和 totalCount。
 * @param gridRef Grid 组件的引用，用于操作布局动画和滚动事件。
 * 
 * @returns 包含 items (响应式数据源) 和 handleScrollSettled (滚动回调)。
 */
export function useVirtualMasonryDataProviderLogic(
    props: VirtualMasonryDataProviderProps,
    gridRef: Ref<InstanceType<typeof VirtualMasonryGrid> | null>
) {
    const { items, requestDataForRange } = useVirtualDataSource({
        totalCount: toRef(props, "totalCount"),
        dataFetcher: props.dataFetcher,
    });

    return {
        items,
        /**
         * @description
         * 处理 Grid 组件的 scroll-settled 事件。
         * 根据可见区域的索引去加载数据，并在加载前后细粒度地控制 Grid 的过渡动画，
         * 以防止占位符被真实内容替换时产生视觉抖动。
         * 
         * @param visibleIndices 当前视口内可见的 item 索引数组
         */
        handleScrollSettled: async (visibleIndices: number[]) => {
            if (visibleIndices.length === 0) {
                return;
            }

            // 加载数据前禁用布局动画，防止占位符被替换时的布局抖动
            if (gridRef.value) {
                gridRef.value.setTransitionEnabled(false);
            }

            try {
                const fetchedItems = await requestDataForRange(visibleIndices);

                // @织: 只有当实际获取到新数据时，才可能发生布局抖动
                // 使用卫语句处理无新数据的情况
                const hasNewItems = fetchedItems && fetchedItems.length > 0;

                if (!hasNewItems) {
                    // 没有新数据时也要恢复动画状态
                    gridRef.value?.setTransitionEnabled(true);
                    return;
                }

                // 有新数据且 grid 存在
                if (!gridRef.value) {
                    return;
                }

                // @织: 命令 grid 在接下来 200ms 内忽略滚动事件
                gridRef.value.ignoreScrollEventsFor(200);

                // 等待DOM更新完成后再启用过渡动画
                await nextTick();

                // 使用 requestAnimationFrame 确保在下一帧渲染前启用过渡
                requestAnimationFrame(() => {
                    gridRef.value?.setTransitionEnabled(true);
                });

            } catch (error) {
                // 发生错误时确保恢复动画状态
                console.error("[VirtualMasonryDataProvider] 数据加载错误:", error);
                gridRef.value?.setTransitionEnabled(true);
            }
        }
    };
}
