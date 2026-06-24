/**
 * onDrop 拖拽放置模块的类型定义
 *
 * 作用：集中管理 dnd drop 相关的接口和类型
 * 使用场景：onDrop、onDragOver、onDragLeave 等模块共享的状态类型
 */

/**
 * 拖拽放置状态
 *
 * 用途：在 onDrop / onDragOver / onDragLeave 之间共享的可变状态
 * 使用场景：编辑器初始化时创建，贯穿整个拖拽生命周期
 * 关联类型：由 protyle 初始化代码创建并传递给各 dnd 处理函数
 */
export interface IDndState {
    /** 当前 dragover 标记的目标元素，拖拽结束后重置为 undefined */
    dragoverElement: Element | undefined;
    /** 禁用的拖拽方向标记，用于限制某些元素的拖拽方向 */
    disabledPosition: string;
    /** dragenter/dragleave 计数器，用于正确判断是否真正离开了目标区域 */
    counter: number;
    /** 列表拖拽层级线缓存，避免高频 dragover 中重复计算缩进和颜色 */
    dragCache?: { nodeId: string; indent: number; rgb: { r: number; g: number; b: number }; guides: string };
    /** 当前目标块文本缓存，用于拖拽提示 */
    cachedTargetText?: string;
    /** 当前目标是否在列布局超级块内 */
    cachedIsCol?: boolean;
}
