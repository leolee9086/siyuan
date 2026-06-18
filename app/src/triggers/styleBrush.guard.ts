/** 用途：IStyleBrushParameters 样式刷参数类型。使用范围：类型守卫返回值标注。解耦评估：类型导入，不涉及运行时耦合。 */
import type { IStyleBrushParameters } from "../registry/TriggerRegistry.types";

/**
 * 判断是否为样式刷子参数
 * 
 * @returns 是否符合 IStyleBrushParameters 接口定义
 */
export function isStyleBrushParameters(target: unknown): target is IStyleBrushParameters {
    if (typeof target !== "object" || target === null) {
        return false;
    }

    // 检查必需属性 sourceStyle
    if (!("sourceStyle" in target) || typeof (target as IStyleBrushParameters).sourceStyle !== "string") {
        return false;
    }

    // sourceBlockId 是可选的，如果存在则必须是 string
    if ("sourceBlockId" in target && typeof (target as IStyleBrushParameters).sourceBlockId !== "string" && (target as IStyleBrushParameters).sourceBlockId !== undefined) {
        return false;
    }

    return true;
}
