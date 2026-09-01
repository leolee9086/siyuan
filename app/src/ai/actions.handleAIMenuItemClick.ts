import { selectRecentDoc } from "./imports";
import { isMobile } from "../platform";
import {
    Constants,
    showMessage,
    fetchPost
} from "./imports";
import type { IPluginMenu } from "../plugin/menu/menu.types";
import { customDialog } from "./customDialog";
import { editDialog } from "./actions.editDialog";
import { fillContent } from "./actions.fillContent";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { AIMenuContext, AIMenuRequest } from "./types";
/**
 * 处理 b3-list-item__action 类元素的点击事件
 * @param currentTarget 当前点击的目标元素
 * @param menu 菜单实例
 * @param event 事件对象
 */
const handleListItemActionClick = (
    currentTarget: HTMLElement | SVGElement,
    menu: IPluginMenu,
    event: Event
) => {
    // 对于SVG元素，需要找到包含dataset的父元素
    const parentElement = currentTarget.parentElement;
    if (!parentElement || !("dataset" in parentElement)) {
        return;
    }
    const targetIndex = parentElement.dataset.index;
    if (targetIndex === undefined) {
        return;
    }
    const localAI = getSiyuanStorage()[Constants.LOCAL_AI];
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
) => {
    const { protyle, ids, elements, menu, clearContext } = context;

    // 对于SVG元素，需要找到包含dataset的元素
    let targetElement: HTMLElement | SVGElement | ParentNode = currentTarget;
    while (targetElement && !("dataset" in targetElement)) {
        const parent = targetElement.parentElement;
        if (!parent) {
            break;
        }
        targetElement = parent;
    }

    if (!targetElement || !("dataset" in targetElement)) {
        return;
    }

    // 非移动端 recentDocs 类型：调用选择最近文档功能
    if (targetElement.dataset.type === "recentDocs" && !isMobile) {
        selectRecentDoc().then(
            async (docId) => {
                console.log(docId);
            }
        );
    }
    // 卫语句1: 处理 recentDocs 类型的通用逻辑（关闭菜单并返回）
    if (targetElement.dataset.type === "recentDocs") {
        menu.close();
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    // 卫语句2: 处理 custom 类型
    if (targetElement.dataset.type === "custom") {
        customDialog(protyle, ids, elements);
        menu.close();
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    // 默认处理: chatGPTWithAction
    fetchPost("/api/ai/chatGPTWithAction", { ids, action: targetElement.dataset.action }, (response) => {
        fillContent(protyle, response.data, elements);
    });

    if (targetElement.dataset.action === clearContext) {
        showMessage(siyuanI18n.clearContextSucc);
    }
    if (targetElement.dataset.action !== clearContext) {
        menu.close();
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
        }
        if (currentTarget.classList.contains("b3-list-item")) {
            handleListItemClick(currentTarget, context, event);
            break;
        }
        const parent = currentTarget.parentElement;
        if (!parent) {
            break;
        }
        currentTarget = parent;
    }
};

