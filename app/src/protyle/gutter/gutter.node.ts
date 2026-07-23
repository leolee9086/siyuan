import {isInEmbedBlock} from "../util/hasClosest";
import {getEmbedChildOperationContext} from "../wysiwyg/getBlock";

/**
 * 作用：把 Gutter 按钮稳定解析为当前可视的真实块元素。
 * 意图：同一块 ID 可同时存在于正文和查询嵌入结果，需要以 data-embed-id 和 Gutter 垂直位置消除歧义。
 * 调用时机：块标点击、折叠、菜单和选区恢复需要从按钮回到块 DOM 时。
 */
// 导出说明：Gutter 事件与菜单共用的块节点解析器。
export const getGutterNodeElement = (protyle: IProtyle, element: Element) => {
    if (element.tagName !== "BUTTON") {
        return element;
    }
    const id = element.getAttribute("data-node-id");
    if (!id || !protyle.wysiwyg?.element || !protyle.gutter) {
        return;
    }
    const embedID = (element as HTMLElement).dataset.embedId;
    return Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${id}"]`)).find((item) => {
        if (!protyle.gutter?.isMatchNode(item)) {
            return false;
        }
        const embedElement = isInEmbedBlock(item, false);
        if (embedID) {
            return !!embedElement && embedElement.getAttribute("data-node-id") === embedID &&
                !!getEmbedChildOperationContext(item);
        }
        return !embedElement;
    });
};
