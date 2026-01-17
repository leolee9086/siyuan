/**
 * ToolItem.utils.ts - 工具项组件工具函数
 * 
 * 提供工具项组件所需的业务逻辑函数。
 * 
 * @module sforge/panel/ToolItem.utils
 */

/**
 * @function 获取显示名称
 * @zh-CN
 * @作用: 从触发器 type 中提取可读的显示名称
 * @意图: 让用户看到友好的工具名称
 * @调用时机: 渲染工具项时
 * @param type 触发器类型标识
 * @returns 可读的显示名称
 */
export function 获取显示名称(type: string): string {
    // 如果 type 本身是中文，直接使用
    if (/[\u4e00-\u9fa5]/.test(type)) {
        return type;
    }

    // 移除 "s-forge-" 前缀，将 kebab-case 转为空格分隔
    return type.replace(/^s-forge-/, "").replace(/-/g, " ");
}

/**
 * @function 获取图标链接
 * @zh-CN
 * @作用: 根据触发器类型选择合适的图标
 * @意图: 为不同工具提供视觉区分
 * @调用时机: 渲染工具项时
 * @param type 触发器类型标识
 * @returns 图标的 SVG use 链接
 */
export function 获取图标链接(type: string): string {
    // 根据已知类型映射图标
    if (type.includes("style-brush") || type.includes("样式刷")) {
        return "#iconFormat";
    }

    // 默认图标
    return "#iconPlugin";
}
