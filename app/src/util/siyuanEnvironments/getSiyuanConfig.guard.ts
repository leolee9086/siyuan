/** 用途：uiLayout schema 中的布局校验函数。使用范围：centerLayout 类型守卫。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { layoutLayoutSchema } from "../../config/configSchemas/uiLayout.schema";
/** SiyuanLayout 从 window.siyuan.layout 推导的布局类型，用于类型守卫的返回值标注 */
type SiyuanLayout = NonNullable<NonNullable<typeof window.siyuan>["layout"]>;

/**
 * 检查给定对象是否是有效的 centerLayout
 * 
 * 作用：验证布局参数是否有效
 * 意图：防止无效的布局参数被设置到 window.siyuan.layout.centerLayout
 * 调用时机：在 setSiyuanLayoutCenterLayout 中调用
 * 
 * 注意：需要同时支持两种情况：
 * 1. JSON 配置对象（用于布局配置验证）
 * 2. Layout 类实例（新窗口初始化时使用）
 * 
 * @param layout 待验证的布局对象
 * @returns 如果是有效的 centerLayout 返回 true
 */
export const isCenterLayout = (layout: unknown): layout is NonNullable<SiyuanLayout["centerLayout"]> => {
    // 如果是 null 或 undefined，直接返回 false
    if (!layout) {
        return false;
    }

    // 检查是否是 Layout 类实例（运行时对象）
    // Layout 实例有 element, children, direction 等属性
    const isObject = typeof layout === "object" && layout !== null;
    const obj = isObject ? (layout as Record<string, unknown>) : null;
    // 检查是否是 Layout 类实例的特征属性：合并 element/children/id 三项判断，避免嵌套 if。
    const isLayoutInstance = obj !== null && "element" in obj && "children" in obj && "id" in obj;
    if (isLayoutInstance) {
        // 这是一个 Layout 类实例
        return true;
    }

    // 否则尝试用 Zod schema 验证（用于 JSON 配置验证）
    return layoutLayoutSchema.safeParse(layout).success;
};

