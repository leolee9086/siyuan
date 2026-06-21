import { matchHotKey } from "../util/hotKey";
import { getContenteditableElement } from "./getBlock";
import { updateTransaction } from "./transaction";
import { Constants } from "../../constants";
import { getSiyuanConfig, getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isInEmbedBlock } from "../util/hasClosest";

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
            // 需要导入 highlightRender，但为了避免循环依赖，这里使用全局调用
            if (window.hljs) {
                const highlightRender = (element: HTMLElement) => {
                    const codeElement = element.querySelector("code");
                    if (codeElement) {
                        const language = element.querySelector(".protyle-action__language")?.textContent || "plaintext";
                        if (window.hljs.getLanguage(language)) {
                            codeElement.innerHTML = window.hljs.highlight(codeElement.textContent, { language, ignoreIllegals: false }).value;
                        }
                    }
                };
                newNodeElement instanceof HTMLElement && highlightRender(newNodeElement);
            }
            event.stopPropagation();
            event.preventDefault();
            controller.abort("代码块创建完成");
            return;
        }
    }
};
