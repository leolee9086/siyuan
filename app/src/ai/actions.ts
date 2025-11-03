import {
    fetchPost,
    focusByRange,
    Constants,
    escapeAriaLabel,
    escapeAttr,
    escapeHtml,
    showMessage,
    Menu,
    upDownHint,
    getElementsBlockId
} from "./imports";
import { fillContent } from "./actions.fillContent";
import { AIChat } from "./chatStream";
import { AIMenuContext, AIMenuRequest, handleAIMenuItemClick } from "./actions.handleAIMenuItemClick";
import { customDialog } from "./customDialog";
import { filterAIMenuItems } from "./actions.filterAIMenuItems";
import { generateBuildingMenuHTML } from "./actions.generateBuildingMenuHTML";
import { siyuanI18n } from "../util/i18n.getI18n";

/**
 * 生成自定义AI菜单项的HTML
 * @returns 自定义菜单项的HTML字符串
 */
const generateCustomMenuItems = (storage:Record<string,unknown>): string => {
    let localAIItems = storage[Constants.LOCAL_AI]
    if(!Array.isArray(localAIItems)){
        throw ('传入的AI定义表不是有效的数组')
    }
    let customHTML = "";
    localAIItems.forEach((item: { name: string, memo: string }, index: number) => {
        customHTML += `<div data-action="${escapeAttr(item.memo || item.name)}" data-index="${index}" class="b3-list-item b3-list-item--narrow ariaLabel" aria-label="${escapeAriaLabel(item.memo)}">
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    <span data-type="edit" class="b3-list-item__action"><svg><use xlink:href="#iconEdit"></use></svg></span>
</div>`;
    });

    // 添加AI聊天菜单项
    const aiChatHTML = `<div data-action="aiChat" class="b3-list-item b3-list-item--narrow ariaLabel" aria-label="AI聊天">
    <span class="b3-list-item__text">AI聊天</span>
    <span class="b3-list-item__action"><svg><use xlink:href="#iconChat"></use></svg></span>
</div>`;

    if (customHTML || aiChatHTML) {
        customHTML = `<div class="b3-menu__separator"></div>${customHTML}${aiChatHTML}`;
    }
    return customHTML;
};

/**
 * 处理键盘按下事件
 * @param event 键盘事件
 * @param listElement 列表元素
 * @param protyle Protyle实例
 * @param ids 元素ID列表
 * @param elements 元素列表
 * @param menu 菜单实例
 * @param clearContext 清除上下文的标识
 */
const handleKeyDown = (
    event: KeyboardEvent,
    listElement: HTMLElement,
    protyle: IProtyle,
    ids: string[],
    elements: HTMLElement[],
    menu: Menu,
    clearContext: string
) => {
    if (event.isComposing) {
        return;
    }
    const currentElement = upDownHint(listElement, event);
    if (currentElement) {
        event.stopPropagation();
    }
    if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const currentElement = listElement.querySelector(".b3-list-item--focus") as HTMLElement;
        if (currentElement.dataset.type === "custom") {
            customDialog(protyle, ids, elements);
            menu.close();
        } else if (currentElement.dataset.action === "aiChat") {
            AIChat(protyle, elements[0]);
            menu.close();
        } else {
            fetchPost("/api/ai/chatGPTWithAction", {
                ids,
                action: currentElement.dataset.action
            }, (response) => {
                fillContent(protyle, response.data, elements);
            });
            if (currentElement.dataset.action === clearContext) {
                showMessage(siyuanI18n.clearContextSucc);
            } else {
                menu.close();
            }
        }
    }
};



/**
 * 处理点击事件
 * @param event 点击事件
 * @param protyle Protyle实例
 * @param ids 元素ID列表
 * @param elements 元素列表
 * @param menu 菜单实例
 * @param clearContext 清除上下文的标识
 */
const handleClick = (
    event: Event,
    protyle: IProtyle,
    ids: string[],
    elements: HTMLElement[],
    menu: Menu,
    clearContext: string,
    menuElement: HTMLElement
) => {
    const target = event.target;
    /**
     * 修复：支持 HTMLElement 和 SVGElement，使 SVGSymbol 图标能够响应点击
     */
    if (target instanceof HTMLElement || target instanceof SVGElement) {
        const currentElement = target.closest(".b3-list-item") as HTMLElement;
        if (currentElement && currentElement.dataset.action === "aiChat") {
            AIChat(protyle, elements[0]);
            menu.close();
            return;
        }

        const context: AIMenuContext = {
            protyle,
            ids,
            elements: elements,
            menu,
            clearContext
        };
        const request: AIMenuRequest = {
            target: target, // 类型转换，因为 handleAIMenuItemClick 期望 HTMLElement
            element: menuElement,
            event
        };

        handleAIMenuItemClick(context, request);
    }
};

/**
 * 设置移动端样式
 * @param element 菜单元素
 */
const setupMobileStyles = (element: HTMLElement) => {
    /// #if MOBILE
    element.setAttribute("style", "height: 100%;padding: 0 16px;");
    element.querySelectorAll(".b3-menu__separator").forEach(item => {
        item.remove();
    });
    /// #endif
};

/**
 * 绑定AI菜单的事件处理
 * @param element 菜单元素
 * @param protyle Protyle实例
 * @param ids 元素ID列表
 * @param elements 元素列表
 * @param menu 菜单实例
 * @param clearContext 清除上下文的标识
 */
const bindMenuEvents = (
    element: HTMLElement,
    protyle: IProtyle,
    ids: string[],
    elements: HTMLElement[],
    menu: Menu,
    clearContext: string
) => {
    // 设置移动端样式
    setupMobileStyles(element);

    // 获取元素引用
    const listElement = element.querySelector(".b3-list");
    const inputElement = element.querySelector("input");
    if (!inputElement) {
        throw ("未能找到输入框元素")
    }
    // 绑定键盘事件
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (listElement instanceof HTMLElement) {
            handleKeyDown(event, listElement, protyle, ids, elements, menu, clearContext);
        }
    });

    // 绑定组合输入结束事件
    inputElement.addEventListener("compositionend", () => {
        filterAIMenuItems(element, inputElement);
    });

    // 绑定输入事件
    inputElement.addEventListener("input", (event: Event) => {
        if (event instanceof InputEvent && event.isComposing) {
            return;
        }

        filterAIMenuItems(element, inputElement);
    });

    // 绑定点击事件
    element.addEventListener("click", (event) => {
        handleClick(event, protyle, ids, elements, menu, clearContext, element);
    });
};

const getSiyuanStorage = ()=>{
    if(!window.siyuan.storage){
        console.error(window.siyuan)
        throw ('siyuan 对象结构错误')
    }
    if(!Array.isArray (window.siyuan.storage[Constants.LOCAL_AI]) ){
        console.error(window.siyuan.storage[Constants.LOCAL_AI])
        throw  (`siyuan 对象结构错误 ${Constants.LOCAL_AI}应该是一个数组`)
    
    }
    return window.siyuan.storage
}

export const openAIActionsMenu = (elements: Element[], protyle: IProtyle) => {
   
    window.siyuan.menus?.menu.remove();
    const ids = getElementsBlockId(elements)
    const menu = new Menu("ai", () => {
        protyle.toolbar?.range&&focusByRange(protyle.toolbar.range);
    });

    // 使用独立函数生成自定义菜单项HTML
    const customHTML = generateCustomMenuItems(getSiyuanStorage());
    const clearContext = "Clear context";

    // 使用独立函数生成菜单HTML模板
    const menuHTML = generateBuildingMenuHTML(customHTML);

    // 将Element[]转换为HTMLElement[]
    const htmlElements = elements as HTMLElement[];

    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: menuHTML,
        bind(element) {
            // 使用独立函数绑定菜单事件
            bindMenuEvents(element, protyle, ids, htmlElements, menu, clearContext);
        }
    });

    menu.element.querySelector(".b3-menu__items")?.setAttribute("style", "overflow: initial");
    /// #if MOBILE
    menu.fullscreen();
    /// #else
    const rect = elements[elements.length - 1].getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
    });
    menu.element.querySelector("input")?.focus();
    /// #endif
};
