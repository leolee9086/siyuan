/**
 * 创建工具栏分隔线元素
 *
 * 作用：渲染工具栏中的视觉分隔符
 * 意图：使用函数式渲染替代类实例化实现
 * 调用时机：ToolbarItemFactory 在识别到 `|` 时调用
 */
export const createToolbarDividerElement = (): HTMLDivElement => {
    const element = document.createElement("div");
    element.className = "protyle-toolbar__divider";
    return element;
};
