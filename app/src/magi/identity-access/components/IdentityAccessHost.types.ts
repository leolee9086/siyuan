/**
 * 用途：标识 Identity Access 当前挂载容器。
 * 使用场景：共享宿主组件和挂载控制器只据此设置布局类，不分叉业务逻辑。
 * 关联类型：IdentityAccessMountOptions.hostKind。
 */
export type IdentityAccessHostKind = "dock" | "tab" | "standalone";

/**
 * 用途：描述共享 Identity Access 挂载参数。
 * 使用场景：Dock、Tab 和独立页面适配器创建 Vue 应用时传入。
 * 关联类型：IdentityAccessHostKind。
 */
export interface IdentityAccessMountOptions {
    hostKind: IdentityAccessHostKind;
}
