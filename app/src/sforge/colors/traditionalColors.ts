/** 用途：复现 TEColors 中国传统色的分组顺序；使用范围：传统色面板初始化和搜索结果；解耦评估：纯函数只接收颜色数组，不依赖 Vue 或宿主状态。 */
import type {PaletteColor} from "./types";

/** 按颜色名称末字分组并保持组内原始顺序，匹配 TEColors 的传统色展示顺序。 */
export const groupTraditionalColors = (colors: PaletteColor[]) => {
    const groups = new Map<string, PaletteColor[]>();
    for (const color of colors) {
        const groupKey = color.name?.slice(-1) || "";
        const group = groups.get(groupKey) || [];
        group.push(color);
        groups.set(groupKey, group);
    }
    return Array.from(groups.values()).flat();
};
