import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { Menu } from "../plugin/Menu";
import { fetchPost } from "../util/fetch";
import { customDialog } from "./actions.customDialog";
import { editDialog } from "./actions.editDialog";
import { fillContent } from "./actions.fillContent";


export interface AIMenuContext {
    protyle: IProtyle;
    ids: string[];
    elements: Element[];
    menu: Menu;
    clearContext: string;
}export interface AIMenuRequest {
    target: HTMLElement;
    element: HTMLElement;
    event: Event;
}
/**
 * 处理 b3-list-item__action 类元素的点击事件
 * @param currentTarget 当前点击的目标元素
 * @param menu 菜单实例
 * @param event 事件对象
 */
const handleListItemActionClick = (
    currentTarget: HTMLElement,
    menu: Menu,
    event: Event
): void => {
    const subItem = window.siyuan.storage[Constants.LOCAL_AI][currentTarget.parentElement.dataset.index];
    editDialog(subItem.name, subItem.memo);
    menu.close();
    event.stopPropagation();
    event.preventDefault();
};

/**
 * 处理 b3-list-item 类元素的点击事件
 * @param currentTarget 当前点击的目标元素
 * @param context AI菜单上下文
 * @param event 事件对象
 */
const handleListItemClick = (
    currentTarget: HTMLElement,
    context: AIMenuContext,
    event: Event
): void => {
    const { protyle, ids, elements, menu, clearContext } = context;
    
    if (currentTarget.dataset.type === "custom") {
        customDialog(protyle, ids, elements);
        menu.close();
    } else {
        fetchPost("/api/ai/chatGPTWithAction", { ids, action: currentTarget.dataset.action }, (response) => {
            fillContent(protyle, response.data, elements);
        });
        if (currentTarget.dataset.action === clearContext) {
            showMessage(window.siyuan.languages.clearContextSucc);
        } else {
            menu.close();
        }
    }
    event.stopPropagation();
    event.preventDefault();
};

export const handleAIMenuItemClick = (context: AIMenuContext, request: AIMenuRequest) => {
    const { menu } = context;
    const { target: initialTarget, element, event } = request;

    let currentTarget = initialTarget;
    while (currentTarget !== element) {
        if (currentTarget.classList.contains("b3-list-item__action")) {
            handleListItemActionClick(currentTarget, menu, event);
            break;
        } else if (currentTarget.classList.contains("b3-list-item")) {
            handleListItemClick(currentTarget, context, event);
            break;
        }
        currentTarget = currentTarget.parentElement;
    }
};

