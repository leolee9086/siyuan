/** 用途：颜色工具状态结构；使用范围：本地状态读写和颜色复制；解耦评估：纯类型依赖，不引入运行时耦合。 */
import type {ColorToolState, PaletteColor} from "./types";
/** 用途：校验 JSON 恢复结果；使用范围：loadColorToolState；解耦评估：将类型守卫集中到 guards 文件，状态模块只负责持久化策略。 */
import {isColorToolState} from "./store.guards";

const STORAGE_KEY = "sforge-tecolors-state";

const defaultState = (): ColorToolState => ({
    recentColors: [],
    customColors: [],
    palettes: [],
    maxImageColors: 5,
});

/** 读取并清洗颜色工具的本地状态，异常或旧数据会回退到默认状态。 */
export const loadColorToolState = (): ColorToolState => {
    const fallback = defaultState();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return fallback;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!isColorToolState(parsed)) {
            return fallback;
        }
        return {
            recentColors: parsed.recentColors,
            customColors: parsed.customColors,
            palettes: parsed.palettes,
            maxImageColors: Math.min(13, Math.max(1, Math.round(parsed.maxImageColors))),
        };
    } catch (error) {
        console.warn("[S-Forge Colors] 读取颜色工具状态失败", error);
        return fallback;
    }
};

/** 保存颜色工具状态；浏览器存储不可用时保留内存状态并记录诊断信息。 */
export const saveColorToolState = (state: ColorToolState): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn("[S-Forge Colors] 保存颜色工具状态失败", error);
    }
};

/** 深复制颜色数组，避免编辑色板时意外修改图片分析结果。 */
export const cloneColors = (colors: PaletteColor[]): PaletteColor[] => colors.map(item => ({
    ...item,
    rgb: [item.rgb[0], item.rgb[1], item.rgb[2]],
}));
