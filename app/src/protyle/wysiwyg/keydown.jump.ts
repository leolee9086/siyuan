import { jumpToParent } from "../../block/util";
import { matchHotKey } from "../util/hotKey";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 块级跳转中间件 - 处理编辑器中的块级导航快捷键
 * 实现文档块结构之间的快速导航，提高用户在复杂文档中的编辑效率
 * 跳转到父级块、上一个同级块和下一个同级块
 * 匹配成功后立即阻止事件传播和默认行为，避免冲突
 *
 * @param event 键盘事件对象
 * @param protyle 编辑器实例
 * @param nodeElement 当前焦点所在的DOM元素
 * @param range 当前文本选择范围
 * @param controller 用于控制中间件链执行的AbortController
 */
export const jumpToMiddleWare = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController

) => {
    // 检查是否按下跳转到下一个同级块的快捷键
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.jumpToParentNext.custom, event)) {
        jumpToParent(protyle, nodeElement, "next");
        event.preventDefault();
        event.stopPropagation();
        controller.abort("跳转到下一个同级块");
        return;
    }

    // 检查是否按下跳转到父级块的快捷键
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.jumpToParent?.custom, event)) {
        jumpToParent(protyle, nodeElement, "parent");
        event.preventDefault();
        event.stopPropagation();
        controller.abort("跳转到父级块");
        return;
    }

    // 检查是否按下跳转到上一个同级块的快捷键
    if (matchHotKey(getSiyuanConfig().keymap.editor.general.jumpToParentPrev?.custom, event)) {
        jumpToParent(protyle, nodeElement, "previous");
        event.preventDefault();
        event.stopPropagation();
        controller.abort("跳转到上一个同级块");
        return;
    }
};