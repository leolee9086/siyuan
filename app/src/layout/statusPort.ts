/** 状态栏目标类型由 Protyle runtime 统一定义，保留本模块的导出路径兼容。 */
export type {StatusElementTarget} from "../protyle/runtime/status.types";
import type {StatusElementTarget} from "../protyle/runtime/status.types";

/** 将状态栏能力参数解析为元素；未提供或找不到元素表示宿主关闭了统计能力。 */
export const resolveStatusElement = (target?: StatusElementTarget) => {
    if (!target) {
        return undefined;
    }
    if (target instanceof HTMLElement) {
        return target;
    }
    return document.getElementById(target) || undefined;
};
