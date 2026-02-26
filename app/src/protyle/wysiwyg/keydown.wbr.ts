import { setInsertWbrHTML } from "../util/selection";
import { isNotEditBlock } from "./getBlock";

/**
 * WBR插入中间件 - 为输入事件插入Word Break Character以支持光标定位
 * @param event 键盘事件
 * @param protyle 编辑器实例
 * @param nodeElement 当前块元素
 * @param range 当前选区
 * @param controller 中断控制器
 */
export const insertWbrMiddleware = async (
    event: KeyboardEvent & { target: HTMLElement },
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 有可能输入 shift+. ，因此需要使用 event.key 来进行判断
    // 过滤掉特殊键值和功能键
    // 上游 #17084: 添加 typeof 检查确保 event.key 是字符串
    if (typeof event.key !== "string" ||
        event.key === "PageUp" || event.key === "PageDown" ||
        event.key === "Home" || event.key === "End" ||
        event.key.indexOf("Arrow") > -1 || event.key === "Escape" ||
        event.key === "Shift" || event.key === "Meta" ||
        event.key === "Alt" || event.key === "Control" ||
        event.key === "CapsLock" || /^F\d{1,2}$/.test(event.key) ||
        event.key === "Process") {
        return;
    }
    // 检查是否为可编辑块
    if (isNotEditBlock(nodeElement)) {
        return;
    }
    // 插入WBR并设置阻止keyup标志
    setInsertWbrHTML(nodeElement, range, protyle);
    protyle.wysiwyg && (protyle.wysiwyg.preventKeyup = true);
};