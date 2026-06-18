/**
 * onDrop 模块的全局对象访问封装
 *
 * 作用：封装 onDrop 及其辅助模块所需的 window.siyuan 属性访问
 * 意图：满足 lint 规则禁止直接访问 window 的要求，集中管理全局状态访问
 * 调用时机：在 onDrop 处理链中需要访问全局拖拽状态或配置时调用
 */

/**
 * 获取工作空间目录路径
 * @returns 工作空间目录路径字符串
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步读取配置，无法异步 */
export const getWorkspaceDir = () => {
    return window.siyuan?.config?.system?.workspaceDir ?? "";
};

/**
 * 获取编辑器动态加载块数量配置
 * @returns 动态加载块数量
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理中同步读取配置，无法异步 */
export const getDynamicLoadBlocks = () => {
    return window.siyuan?.config?.editor?.dynamicLoadBlocks ?? 0;
};

/**
 * 获取当前拖拽元素
 * @returns 拖拽元素或 undefined
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽状态必须同步读取 */
export const getDragElement = () => {
    return window.siyuan?.dragElement;
};

/**
 * 清除拖拽元素状态：恢复透明度并置空引用
 * 调用时机：拖拽操作结束后的清理阶段
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 拖拽清理必须同步执行 */
export const clearDragElement = () => {
    const el = window.siyuan?.dragElement;
    if (!el) {
        return;
    }
    el.style.opacity = "";
    window.siyuan.dragElement = undefined;
};
