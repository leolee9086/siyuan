import { createToolbarItemElement } from "./ToolbarItem";
import { linkMenu } from "../../menus/protyleMenus/linkMenu/protyle.linkMenu";
import { hasClosestBlock, hasClosestByAttribute } from "../util/hasClosest";
import { readClipboard } from "../util/compatibility";
import { Constants } from "../../constants";

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
    element.addEventListener("click", async (event: MouseEvent & { changedTouches: MouseEvent[] }) => {
        protyle.toolbar.element.classList.add("fn__none");
        event.stopPropagation();

        const range = protyle.toolbar.range;
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
                const html = clipObject.textHTML || protyle.lute.Md2BlockDOM(clipObject.textPlain);
                if (html) {
                    const tempElement = document.createElement("template");
                    tempElement.innerHTML = html;
                    const linkElement = tempElement.content.querySelector('span[data-type~="a"], a');
                    if (linkElement) {
                        dataText = dataText || linkElement.textContent;
                        dataHref = linkElement.getAttribute("data-href") || linkElement.getAttribute("href");
                    }
                }
                if (!dataHref) {
                    dataHref = protyle.lute.GetLinkDest(clipObject.textPlain);
                }
                if (!dataHref) {
                    // 360
                    const lastSpace = clipObject.textPlain.lastIndexOf(" ");
                    if (lastSpace > -1) {
                        dataHref = protyle.lute.GetLinkDest(clipObject.textPlain.substring(lastSpace));
                        if (dataHref && !dataText) {
                            dataText = clipObject.textPlain.substring(0, lastSpace);
                        }
                    }
                }
                // https://github.com/siyuan-note/siyuan/issues/12867
                if (!dataHref && clipObject.textPlain.startsWith("assets/")) {
                    dataHref = clipObject.textPlain;
                }
                // https://github.com/siyuan-note/siyuan/issues/14704#issuecomment-2867555769 第一点 & https://github.com/siyuan-note/siyuan/issues/6798
                if (dataHref && !dataText) {
                    dataText = decodeURIComponent(dataHref.replace("https://", "").replace("http://", ""));
                    if (dataHref.length > Constants.SIZE_LINK_TEXT_MAX) {
                        dataText = dataHref.substring(0, Constants.SIZE_LINK_TEXT_MAX) + "...";
                    }
                    showMenu = true;
                }
            }
        } catch (e) {
            console.log(e);
        }
        const linkElements = protyle.toolbar.setInlineMark(protyle, "a", "range", {
            type: "a",
            color: dataHref + (dataText ? Constants.ZWSP + dataText : "")
        });
        if (showMenu) {
            linkMenu(protyle, linkElements[0] as HTMLElement, true);
        }
    });
    return element;
};
