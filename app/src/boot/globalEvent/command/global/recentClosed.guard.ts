/**
 * 判断最近关闭标签中的 children 是否是布局 JSON。
 * @同步豁免: 类型守卫 - 恢复最近关闭标签页需要在同步调用链中收窄 children 类型。
 * @显式返回类型原因: 类型守卫必须显式声明类型谓词，调用方才能收窄 children 为 ILayoutJSON。
 */
export const isRecentClosedChildLayout = (children: unknown): children is ILayoutJSON => {
    return !!children && typeof children === "object" && "instance" in children;
};
