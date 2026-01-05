import { type DataFetcher } from "../composables/useVirtualDataSource";
import VirtualMasonryGrid from "./VirtualMasonryGrid.vue";

/**
 * @name GridComponentProps
 * @description
 * 从 VirtualMasonryGrid 组件获取其 Props 类型定义。
 * 不包含 VNodeProps (key, ref 等)，只包含组件自身的 props。
 * 
 * @usage
 *用于 VirtualMasonryDataProviderProps 继承。
 */
export type GridComponentProps = InstanceType<typeof VirtualMasonryGrid>["$props"];

/**
 * @name VirtualMasonryDataProviderProps
 * @description
 * VirtualMasonryDataProvider 组件的属性定义。
 * 
 * @usage
 * 用于 defineProps<VirtualMasonryDataProviderProps>()。
 * 
 * @relation
 * 继承自 GridComponentProps，但排除了 items, estimatedTotalCount, onScrollSettled。
 */
export interface VirtualMasonryDataProviderProps extends /* @vue-ignore */ Omit<GridComponentProps, "items" | "estimatedTotalCount" | "onScrollSettled"> {
    /** 
     * 数据总数，用于虚拟列表估算高度 
     */
    totalCount: number;
    /** 
     * 数据获取器函数，用于按需加载数据 
     */
    dataFetcher: DataFetcher;
}
