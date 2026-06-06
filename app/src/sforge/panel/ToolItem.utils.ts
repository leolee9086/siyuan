/**
 * ToolItem.utils.ts - 工具项组件工具函数
 * 
 * 提供工具项组件所需的业务逻辑函数。
 * 
 * @module sforge/panel/ToolItem.utils
 */

/**
 * 导出 获取显示名称 供工具项组件渲染使用。
 * @function 获取显示名称
 * @同步豁免: UI构建 - 在 Vue computed 属性中作为同步 getter 调用，异步化会破坏 computed 的同步契约。
 */
export function 获取显示名称(type: string) {
    // 如果 type 本身是中文，直接使用
    if (/[\u4e00-\u9fa5]/.test(type)) {
        return type;
    }

    // 移除 "s-forge-" 前缀，将 kebab-case 转为空格分隔
    return type.replace(/^s-forge-/, "").replace(/-/g, " ");
}

/**
 * 导出 获取图标链接 供工具项组件渲染使用。
 * @function 获取图标链接
 * @同步豁免: UI构建 - 在 Vue computed 属性中作为同步 getter 调用，异步化会破坏 computed 的同步契约。
 */
export function 获取图标链接(type: string) {
    // 根据已知类型映射图标
    if (type.includes("style-brush") || type.includes("样式刷")) {
        return "#iconFormat";
    }

    // 默认图标
    return "#iconPlugin";
}
