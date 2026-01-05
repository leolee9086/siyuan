/**
 * @leolee9086/my-masonry
 * 高性能虚拟瀑布流/网格布局组件库
 */

// --- 主要组件 ---
export { default as VirtualMasonryGrid } from "./components/VirtualMasonryGrid.vue";
export { default as VirtualMasonryDataProvider } from "./components/VirtualMasonryDataProvider.vue";
export { default as SelectionBox } from "./components/SelectionBox.vue";
export { default as SelectionWrapper } from "./components/SelectionWrapper.vue";

// --- 核心 Composables ---
export { useLayoutEngine } from "./composables/useLayoutEngine";
export { useMasonryLayout } from "./composables/useMasonryLayout";
export { useVirtualization } from "./composables/useVirtualization";
export { useScrollObserver } from "./composables/useScrollObserver";
export { useVirtualScrollbar } from "./composables/useVirtualScrollbar";
export { useVirtualDataSource } from "./composables/useVirtualDataSource";
export { useSelectionSystem } from "./composables/useSelectionSystem";
export { useSelectionBox } from "./composables/useSelectionBox";

// --- 类型导出 ---
export type { LayoutItem, UseLayoutEngineOptions, LayoutEngineResult } from "./composables/layout-engines/types";
export type { DataFetcher, DataItem, UseVirtualDataSourceOptions } from "./composables/useVirtualDataSource";
