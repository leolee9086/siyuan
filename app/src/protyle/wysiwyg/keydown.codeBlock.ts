import { matchHotKey } from "../util/hotKey";
import { getContenteditableElement } from "./getBlock";
import { updateTransaction } from "./transaction";
import { Constants } from "../../constants";
import { getSiyuanConfig, getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isInEmbedBlock } from "../util/hasClosest";
import { highlightRender } from "../render/highlightRender";

/**
 * 处理代码块创建的快捷键
 * 当用户按下代码块快捷键时，将当前块转换为代码块
 */
export const handleCodeBlockCreation = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // 检查是否匹配代码块插入快捷键，并且当前块不是代码块、标题或表格
    const blockType = nodeElement.getAttribute("data-type");

    if (!blockType) {
        throw ("块元素缺少类型属性");
    }
    if (!protyle.lute) {
        throw ("protyle缺少lute属性");
    }
    if (!protyle.wysiwyg) {
        throw ("protyle缺少wysiwyg属性");
    }
    if (
        matchHotKey(getSiyuanConfig().keymap.editor.insert.code.custom, event) &&
        !["NodeCodeBlock", "NodeHeading", "NodeTable"].includes(blockType) &&
        !isInEmbedBlock(nodeElement)
    ) {
        const editElement = getContenteditableElement(nodeElement);
        if (editElement) {
            const html = nodeElement.outerHTML;
            // 需要 EscapeHTMLStr https://github.com/siyuan-note/siyuan/issues/11451
            editElement.innerHTML = "```" + getSiyuanStorage()[Constants.LOCAL_CODELANG] + "\n" + Lute.EscapeHTMLStr(editElement.textContent) + "<wbr>\n```";
            nodeElement.insertAdjacentHTML("afterend", protyle.lute.SpinBlockDOM(nodeElement.outerHTML));
            const newNodeElement = nodeElement.nextElementSibling;
            if (!newNodeElement) {
                return;
            }
            nodeElement.remove();
            updateTransaction(protyle, newNodeElement, html);
            event.preventDefault();
            highlightRender(newNodeElement);
            event.stopPropagation();
            controller.abort("代码块创建完成");
            return;
        }
    }
};
