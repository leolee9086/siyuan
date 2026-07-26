import { hasNextSibling, hasPreviousSibling } from "./getBlock";
import { setLastNodeRange, focusByRange } from "../util/selection";
import {updateTransaction} from "./transaction/update";
import { isNotCtrl } from "../util/compatibility";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

export const tabKeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    // tab 需等待 list 和 table 处理完成
    if (event.key === "Tab" && isNotCtrl(event) && !event.altKey) {
        event.preventDefault();
        const tabSpace = getSiyuanConfig().editor.codeTabSpaces === 0 ? "\t" : "".padStart(getSiyuanConfig().editor.codeTabSpaces, " ");
        const selectText = range.toString();

        if (nodeElement.getAttribute("data-type") === "NodeCodeBlock" && selectText !== "") {
            // https://github.com/siyuan-note/siyuan/issues/12650
            if (!hasNextSibling(range.endContainer) && range.endContainer.textContent?.endsWith("\n") && range.endOffset > 0) {
                range.setEnd(range.endContainer, range.endOffset - 1);
            }
            const wbrElement = document.createElement("wbr");
            range.insertNode(wbrElement);
            range.setStartAfter(wbrElement);
            const oldHTML = nodeElement.outerHTML;
            let text = "";
            if (!event.shiftKey) {
                range.extractContents().textContent.split("\n").forEach((item: string) => {
                    text += tabSpace + item + "\n";
                });
            } else {
                range.extractContents().textContent.split("\n").forEach((item: string) => {
                    if (item.startsWith(tabSpace)) {
                        text += item.replace(tabSpace, "") + "\n";
                    } else {
                        text += item + "\n";
                    }
                });
            }
            let language = nodeElement.querySelector(".protyle-action__language")?.textContent;
            // 语言优先级处理 https://github.com/siyuan-note/siyuan/issues/14767
            if (range.commonAncestorContainer.nodeType === 1) {
                const snippetClassName = (range.commonAncestorContainer as HTMLElement).className;
                if (snippetClassName.startsWith("language-")) {
                    language = snippetClassName.replace("language-", "");
                    // https://github.com/siyuan-note/siyuan/issues/14767
                    if (wbrElement.parentElement !== range.commonAncestorContainer) {
                        wbrElement.parentElement?.after(wbrElement);
                        wbrElement.previousElementSibling?.remove();
                    }
                }
            }
            //如果hljs上没有这个语言的话
            if (!language || !window.hljs.getLanguage(language)) {
                language = "plaintext";
            }
            wbrElement.insertAdjacentHTML("afterend", window.hljs.highlight(text.substr(0, text.length - 1), {
                language,
                ignoreIllegals: true
            }).value + "<br>");
            const nextSiblingOfWbr = wbrElement.nextSibling;
            nextSiblingOfWbr && range.setStart(nextSiblingOfWbr, 0);
            const parentElement = wbrElement.parentElement;
            if (parentElement) {
                const brElement = parentElement.querySelector("br");
                if (brElement) {
                    const DataNodeId = nodeElement.getAttribute("data-node-id");
                    if (DataNodeId) {
                        setLastNodeRange(brElement.previousSibling as Element, range, false);
                        brElement.remove();
                        updateTransaction(protyle, DataNodeId, nodeElement.outerHTML, oldHTML);
                        wbrElement.remove();
                        controller.abort("Tab键处理完成");
                    }
                }
            }
            return;
        }

        if (!event.shiftKey) {
            const inlineElement = range.startContainer.parentElement;
            const currentTypes = protyle.toolbar?.getCurrentType(range);
            if (currentTypes) {
                // https://github.com/siyuan-note/siyuan/issues/14703
                if (
                    currentTypes.length > 0 &&
                    range.toString() === "" &&
                    range.startOffset === 0 &&
                    inlineElement?.tagName === "SPAN" &&
                    !hasPreviousSibling(range.startContainer) &&
                    !hasPreviousSibling(inlineElement)
                ) {
                    range.setStartBefore(inlineElement);
                    range.collapse(true);
                } else if (
                    inlineElement?.tagName === "SPAN" &&
                    !currentTypes.includes("search-mark") &&    // https://github.com/siyuan-note/siyuan/issues/7586
                    !currentTypes.includes("code") &&   // https://github.com/siyuan-note/siyuan/issues/13871
                    !currentTypes.includes("kbd") &&
                    !currentTypes.includes("tag") &&
                    range.toString() === "" && range.startContainer.nodeType === 3 &&
                    (currentTypes.includes("inline-memo") || currentTypes.includes("block-ref") || currentTypes.includes("file-annotation-ref") || currentTypes.includes("a")) &&
                    !hasNextSibling(range.startContainer) && range.startContainer.textContent?.length === range.startOffset
                ) {
                    range.setEndAfter(inlineElement);
                    range.collapse(false);
                }
                const dataNodeId = nodeElement.getAttribute("data-node-id");
                if (!dataNodeId) {
                    console.log(nodeElement);
                    throw new Error("块元素结构错误");
                }
                const wbrElement = document.createElement("wbr");
                range.insertNode(wbrElement);
                const oldHTML = nodeElement.outerHTML;
                range.extractContents();
                range.insertNode(document.createTextNode(tabSpace));
                range.collapse(false);
                focusByRange(range);
                wbrElement.remove();
                updateTransaction(protyle, dataNodeId, nodeElement.outerHTML, oldHTML);
                controller.abort("Tab键处理完成");
            }
            return;
        }
    }
};