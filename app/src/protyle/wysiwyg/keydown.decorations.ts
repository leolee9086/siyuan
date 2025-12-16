import { matchHotKey } from "../util/hotKey";

/**
 * 文本装饰快捷键中间件
 *
 * 该中间件用于处理文本装饰相关的快捷键，包括：
 * - ⌘B: 粗体 (Bold)
 * - ⌘I: 斜体 (Italic)
 * - ⌘U: 下划线 (Underline)
 *
 * 虽然这是键盘事件处理链中的最后一步，但为了保持处理流程的一致性，
 * 同样会发出中止信号来阻止后续处理。
 *
 * @param event - 键盘事件对象
 * @param protyle - Protyle 实例，提供编辑器核心功能
 * @param controller - 中止控制器，用于停止后续中间件执行
 */
export const decorationMatchMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 检查是否匹配文本装饰快捷键
    if (matchHotKey("⌘B", event) || matchHotKey("⌘I", event) || matchHotKey("⌘U", event)) {
        // 阻止默认行为和事件冒泡
        event.preventDefault();
        event.stopPropagation();
        
        // 中止后续中间件执行，并说明原因
        controller.abort("文本装饰快捷键已处理");
    }
};