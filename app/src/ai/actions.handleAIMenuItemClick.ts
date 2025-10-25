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
export const handleAIMenuItemClick = (context: AIMenuContext, request: AIMenuRequest) => {
    const { protyle, ids, elements, menu, clearContext } = context;
    const { target: initialTarget, element, event } = request;

    let currentTarget = initialTarget;
    while (currentTarget !== element) {
        if (currentTarget.classList.contains("b3-list-item__action")) {
            const subItem = window.siyuan.storage[Constants.LOCAL_AI][currentTarget.parentElement.dataset.index];
            editDialog(subItem.name, subItem.memo);
            menu.close();
            event.stopPropagation();
            event.preventDefault();
            break;
        } else if (currentTarget.classList.contains("b3-list-item")) {
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
            break;
        }
        currentTarget = currentTarget.parentElement;
    }
};

