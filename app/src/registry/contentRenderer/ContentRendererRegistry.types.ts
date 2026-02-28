/**
 * ContentRendererRegistry.types.ts - 内容块渲染器注册表类型定义
 */

/**
 * 渲染器函数签名
 *
 * 用途：统一所有内容块渲染器的调用签名
 * 使用场景：注册和分发渲染器时的类型约束
 *
 * @param element - 包含待渲染内容的 DOM 元素
 * @param cdn - 可选的 CDN 路径前缀（htmlRender 不使用此参数）
 */
export type ContentRendererFn = (element: Element, cdn?: string) => void | Promise<void>;

/**
 * 渲染器注册信息
 *
 * 用途：描述一个内容块渲染器的注册配置
 * 使用场景：调用 register() 时传入
 * 关联类型：ContentRendererFn
 */
export interface ContentRendererRegistration {
    /** data-subtype 值，作为渲染器的唯一标识 */
    readonly subtype: string;
    /** 渲染函数 */
    readonly render: ContentRendererFn;
}
