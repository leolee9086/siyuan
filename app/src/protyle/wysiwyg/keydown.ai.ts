import { matchHotKey } from "../util/hotKey";
import { openAIActionsMenu } from "../../ai/actions";
import { AIChat } from "../../ai/chat";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";

/**
 * AI操作菜单快捷键中间件
 * 处理AI操作菜单相关的快捷键
 */
export const aiActionsMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
)=> {
    // AI操作菜单快捷键
    if (!event.repeat && matchHotKey(getSiyuanConfig().keymap.editor.general.ai.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        let selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
        if (selectsElement.length === 0) {
            selectsElement = [nodeElement];
        }
        openAIActionsMenu(selectsElement, protyle);
        controller.abort("AI操作菜单快捷键处理");
        return;
    }
};

/**
 * AI写作快捷键中间件
 * 处理AI写作相关的快捷键
 */
export const aiWritingMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    // AI写作快捷键
    if (!event.repeat && matchHotKey(getSiyuanConfig().keymap.editor.general.aiWriting?.custom, event)) {
        event.preventDefault();
        event.stopPropagation();
        AIChat(protyle, nodeElement);
        controller.abort("AI写作快捷键处理");
        return;
    }
};