/**
 * 用途：块背景菜单上下文。
 * 使用场景：在 gutter 菜单中为单块或多块统一应用背景样式、打开来源选择与定位对话框时传递上下文。
 * 关联类型：由 `buildGutterBackgroundMenu` 组装并在块背景菜单内部函数间流转。
 * 问题/改进：当前仅封装 protyle 与节点集合，若后续需要加入来源追踪或撤销元数据，可继续扩展。
 */
export interface IBlockBackgroundMenuContext {
    protyle: IProtyle;
    nodeElements: HTMLElement[];
}

/**
 * 用途：块背景当前状态。
 * 使用场景：在背景来源对话框、外链输入框和位置调整对话框中读取当前块的背景信息。
 * 关联类型：由 `getBlockBackgroundState` 产出，并被来源与位置模块复用。
 * 问题/改进：当前主要覆盖图片背景和基础背景属性，后续如扩展更多背景模式可继续补充字段。
 */
export interface IBlockBackgroundState {
    hasBackground: boolean;
    hasImage: boolean;
    backgroundColor: string;
    backgroundPosition: string;
    url: string;
}

/**
 * 用途：块背景位置拖拽会话。
 * 使用场景：在位置调整对话框中跟踪拖拽起点、可移动高度和预览图片元素。
 * 关联类型：由位置模块创建，并被全局 move/up 处理函数消费。
 * 问题/改进：当前只覆盖纵向拖拽，后续若支持横向裁剪可继续扩展。
 */
export interface IBlockBackgroundPositionSession {
    imageElement: HTMLImageElement;
    height: number;
    originalPositionY: number;
    startY: number;
}
