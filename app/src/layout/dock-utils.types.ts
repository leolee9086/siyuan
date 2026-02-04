/**
 * dock-utils 模块的类型定义
 */

/**
 * 侧边栏数据结构
 * 从 Dock 构造函数中提取的内部数据类型
 */
export type SideData = {
    pin: boolean;
    data: Config.IUILayoutDockTab[][];
};

/**
 * 完整的布局数据
 * 用于 JSONToDock 函数接收的配置对象
 */
export type LayoutData = {
    left: SideData;
    right: SideData;
    bottom: SideData;
};
