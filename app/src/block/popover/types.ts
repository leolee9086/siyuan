/**
 * Popover 模块的类型定义
 */

/**
 * RefDefs 查询结果
 *
 * 用途：封装引用定义查询的返回数据
 * 使用场景：在 refDefs.ts 中所有获取引用定义的函数返回值
 * 关联类型：依赖全局类型 IRefDefs 和 IObject
 */
export interface RefDefsResult {
    refDefs: IRefDefs[];
    originalRefBlockIDs: IObject;
}

/**
 * Tooltip 显示信息
 *
 * 用途：封装 tooltip 显示所需的配置信息
 * 使用场景：在 tooltip.ts 中各类 tooltip 获取函数的返回值，用于传递给 showTooltip 函数
 * 关联类型：独立类型，无依赖
 */
export interface TooltipInfo {
    tip: string;
    tooltipClass: string;
    tooltipSpace?: number;
}

/** 表示资源元数据请求回调渲染 Tooltip 所需的响应、原始文本、目标元素和样式上下文。 */
export interface IStatAssetResponseContext {
    response: IWebSocketData;
    tip: string;
    title: string | null;
    aElement: HTMLElement;
    tooltipClass: string;
}
