 
import type { UseLayoutEngineOptions, LayoutEngineResult } from "./layout-engines/types";
import { useMasonryLayout } from "./layout-engines/masonry/useMasonryLayout";
import { useGridLayout } from "./layout-engines/grid/useGridLayout";
import { useJustifiedLayout } from "./layout-engines/justified/useJustifiedLayout";
import { useListLayout } from "./layout-engines/list/useListLayout";

/**
 * 布局引擎工厂 - 根据模式选择合适的布局实现
 * 
 * 这个组合式函数作为入口点，会根据传入的 mode 选择合适的布局引擎：
 * - masonry: 瀑布流布局，适合不同高度的卡片
 * - grid: 网格布局，每行高度统一
 * - justified: 对齐布局，每行充满容器宽度
 * 
 * @param options 布局引擎配置
 * @returns LayoutEngineResult 布局引擎结果对象
 */
export function useLayoutEngine(options: UseLayoutEngineOptions): LayoutEngineResult {
    const { mode = "masonry" } = options;
    // 根据模式选择不同的布局引擎
    if (mode === "grid") {
        return useGridLayout(options);
    } else if (mode === "justified") {
        return useJustifiedLayout(options);
    } else if (mode === "list") {
        return useListLayout(options);
    } else {
        // 默认使用瀑布流布局
        return useMasonryLayout(options);
    }
} 