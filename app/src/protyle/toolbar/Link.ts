import { createToolbarItemElement } from "./ToolbarItem";
import { linkMenu } from "../../menus/protyleMenus/linkMenu/protyle.linkMenu";
import { hasClosestBlock, hasClosestByAttribute } from "../util/hasClosest";
import { readClipboard } from "../util/compatibility";
import { Constants } from "../../constants";
import { genLinkText, resolveLinkDest } from "./util";
import {reportProtyleUserOperationIntent} from "../intent/userOperationIntent";

/**
 * 创建链接工具栏项
 *
 * 作用：渲染链接按钮并绑定点击行为
 * 意图：使用函数式渲染替代类继承实现
 * 调用时机：ToolbarItemFactory 在识别到 a 时调用
 */
export const createLinkToolbarItem = (protyle: IProtyle, menuItem: IMenuItem): HTMLElement => {
    const element = createToolbarItemElement(protyle, menuItem);
    // 不能用 getEventName，否则会导致光标位置变动到点击的文档中
    element.addEventListener("click", async (event: MouseEvent) => {
        protyle.toolbar.element.classList.add("fn__none");
        event.stopPropagation();

        const range = protyle.toolbar.range;
        if (!range) {
            return;
        }
        const nodeElement = hasClosestBlock(range.startContainer);
        if (!nodeElement) {
            return;
        }
        const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a");
        if (aElement) {
            linkMenu(protyle, aElement);
            return;
        }

        let dataHref = "";
        let dataText = range.toString().trim().replace(Constants.ZWSP, "");
        let showMenu = false;
        try {
            // 选中链接时需忽略剪切板内容 https://ld246.com/article/1643035329737
            dataHref = protyle.lute.GetLinkDest(dataText);
            if (!dataHref) {
                const clipObject = await readClipboard();
                const clipboardText = clipObject.textPlain ?? "";
                const html = clipObject.textHTML || protyle.lute.Md2BlockDOM(clipboardText);
                if (html) {
                    const tempElement = document.createElement("template");
                    tempElement.innerHTML = html;
                    const linkElement = tempElement.content.querySelector('span[data-type~="a"], a');
                    if (linkElement) {
                        dataText = dataText || linkElement.textContent || "";
                        dataHref = linkElement.getAttribute("data-href") || linkElement.getAttribute("href") || "";
                    }
                }
                if (!dataHref) {
                    dataHref = resolveLinkDest(clipboardText, protyle.lute);
                }
                if (!dataHref) {
                    // 360
                    const lastSpace = clipboardText.lastIndexOf(" ");
                    if (lastSpace > -1) {
                        dataHref = protyle.lute.GetLinkDest(clipboardText.substring(lastSpace));
                        if (dataHref && !dataText) {
                            dataText = clipboardText.substring(0, lastSpace);
                        }
                    }
                }
                // https://github.com/siyuan-note/siyuan/issues/14704#issuecomment-2867555769 第一点 & https://github.com/siyuan-note/siyuan/issues/6798
                if (dataHref && !dataText) {
                    dataText = genLinkText(dataHref, true, true);
                    showMenu = true;
                }
            }
        } catch (error) {
            console.error("Failed to inspect clipboard while applying an inline link", error);
        }
        const linkElements = protyle.toolbar.setInlineMark(protyle, "a", "range", {
            type: "a",
            color: dataHref + (dataText ? Constants.ZWSP + dataText : "")
        });
        const createdLinkElements = (linkElements ?? []).filter((node): node is HTMLElement =>
            node instanceof HTMLElement && (node.getAttribute("data-type") ?? "").split(" ").includes("a"));
        if (linkElements && linkElements.length > 0) {
            reportProtyleUserOperationIntent(protyle, {
                actor: "user",
                surface: "editor",
                source: "toolbar",
                operation: "toggle-inline-link",
                trigger: "toolbar-click",
                blockIds: [nodeElement.getAttribute("data-node-id")],
                linkCount: createdLinkElements.length,
            });
        }
        const [firstCreatedLinkElement] = createdLinkElements;
        if (showMenu && firstCreatedLinkElement) {
            linkMenu(protyle, firstCreatedLinkElement, true, createdLinkElements);
        }
    });
    return element;
};
