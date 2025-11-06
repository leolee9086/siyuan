///#if !MOBILE
import { selectRecentDoc } from "./imports";
///#endif
import {
    Constants,
    showMessage,
    Menu,
    fetchPost
} from "./imports";
import { customDialog } from "./customDialog";
import { editDialog } from "./actions.editDialog";
import { fillContent } from "./actions.fillContent";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig";


export interface AIMenuContext {
    protyle: IProtyle;
    ids: string[];
    elements: Element[];
    menu: Menu;
    clearContext: string;
}export interface AIMenuRequest {
    target: HTMLElement | SVGElement;
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
    currentTarget: HTMLElement | SVGElement,
    menu: Menu,
    event: Event
): void => {
    // 对于SVG元素，需要找到包含dataset的父元素
    const parentElement = currentTarget.parentElement;
    if (!parentElement || !('dataset' in parentElement)) {
        return;
    }
    const targetIndex = parentElement.dataset.index
    const localAI = getSiyuanStorage()[Constants.LOCAL_AI]
    const subItem = localAI[targetIndex];
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
    currentTarget: HTMLElement | SVGElement,
    context: AIMenuContext,
    event: Event
): void => {
    const { protyle, ids, elements, menu, clearContext } = context;
    
    // 对于SVG元素，需要找到包含dataset的元素
    let targetElement: HTMLElement | SVGElement | ParentNode = currentTarget;
    while (targetElement && !('dataset' in targetElement)) {
        targetElement = targetElement.parentElement;
    }
    
    if (!targetElement || !('dataset' in targetElement)) {
        return;
    }
    
    if (targetElement.dataset.type === "recentDocs"){
        //使用最近的文档当成actions
        menu.close();
        ///#if !MOBILE
        selectRecentDoc().then(
            async(docId)=>{
                console.log(docId)
                
            }
        )
        ///#endif
    }
    
    else if(targetElement.dataset.type === "custom") {
        customDialog(protyle, ids, elements);
        menu.close();
    } else {
        fetchPost("/api/ai/chatGPTWithAction", { ids, action: targetElement.dataset.action }, (response) => {
            fillContent(protyle, response.data, elements);
        });
        if (targetElement.dataset.action === clearContext) {
            showMessage(siyuanI18n.clearContextSucc);
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

