import { fetchPost } from "../util/fetch";
import { focusByRange } from "../protyle/util/selection";
import { Constants } from "../constants";
import { escapeAriaLabel, escapeAttr, escapeHtml } from "../util/escape";
import { showMessage } from "../dialog/message";
import { Menu } from "../plugin/Menu";
import { upDownHint } from "../util/upDownHint";
import { getElementsBlockId } from "../util/DOM/blockLikeElements";
import { switchFnNoneByFlag } from "../util/DOM/fnClasses";
import { fillContent } from "./actions.fillContent";
import { AIMenuContext, AIMenuRequest, handleAIMenuItemClick } from "./actions.handleAIMenuItemClick";
import { customDialog } from "./actions.customDialog";

/**
 * 生成自定义AI菜单项的HTML
 * @returns 自定义菜单项的HTML字符串
 */
const generateCustomMenuItems = (): string => {
    let customHTML = "";
    window.siyuan.storage[Constants.LOCAL_AI].forEach((item: { name: string, memo: string }, index: number) => {
        customHTML += `<div data-action="${escapeAttr(item.memo || item.name)}" data-index="${index}" class="b3-list-item b3-list-item--narrow ariaLabel" aria-label="${escapeAriaLabel(item.memo)}">
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    <span data-type="edit" class="b3-list-item__action"><svg><use xlink:href="#iconEdit"></use></svg></span>
</div>`;
    });
    if (customHTML) {
        customHTML = `<div class="b3-menu__separator"></div>${customHTML}`;
    }
    return customHTML;
};

/**
 * 生成AI菜单的完整HTML模板
 * @param customHTML 自定义菜单项的HTML
 * @returns 菜单的完整HTML字符串
 */
const generateMenuHTML = (customHTML: string): string => {
    const clearContext = "Clear context";
    return `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${window.siyuan.languages.ai}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
       <div class="b3-list-item b3-list-item--narrow b3-list-item--focus" data-action="Continue writing">
            ${window.siyuan.languages.aiContinueWrite}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiExtractSummary}">
            ${window.siyuan.languages.aiExtractSummary}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiBrainStorm}">
            ${window.siyuan.languages.aiBrainStorm}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiFixGrammarSpell}">
            ${window.siyuan.languages.aiFixGrammarSpell}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${clearContext}">
            ${window.siyuan.languages.clearContext}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-type="custom">
            ${window.siyuan.languages.aiCustomAction}
        </div>
        ${customHTML}
    </div>
</div>`;
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
        } else {
            fetchPost("/api/ai/chatGPTWithAction", {
                ids,
                action: currentElement.dataset.action
            }, (response) => {
                fillContent(protyle, response.data, elements);
            });
            if (currentElement.dataset.action === clearContext) {
                showMessage(window.siyuan.languages.clearContextSucc);
            } else {
                menu.close();
            }
        }
    }
};

/**
 * 处理输入事件
 * @param event 输入事件
 * @param element 菜单元素
 * @param inputElement 输入元素
 */
const handleInput = (
    event: KeyboardEvent,
    element: HTMLElement,
    inputElement: HTMLInputElement
) => {
    if (event.isComposing) {
        return;
    }
    filterAI(element, inputElement);
};

/**
 * 处理组合输入结束事件
 * @param element 菜单元素
 * @param inputElement 输入元素
 */
const handleCompositionEnd = (
    element: HTMLElement,
    inputElement: HTMLInputElement
) => {
    filterAI(element, inputElement);
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
        const context: AIMenuContext = {
            protyle,
            ids,
            elements: elements,
            menu,
            clearContext
        };
        const request: AIMenuRequest = {
            target: target , // 类型转换，因为 handleAIMenuItemClick 期望 HTMLElement
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
    const inputElement = element.querySelector("input") ;
    
    // 绑定键盘事件
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if(listElement instanceof HTMLElement){
        handleKeyDown(event, listElement, protyle, ids, elements, menu, clearContext);
        }
    });
    
    // 绑定组合输入结束事件
    inputElement.addEventListener("compositionend", () => {
        handleCompositionEnd(element, inputElement);
    });
    
    // 绑定输入事件
    inputElement.addEventListener("input", (event: KeyboardEvent) => {
        handleInput(event, element, inputElement);
    });
    
    // 绑定点击事件
    element.addEventListener("click", (event) => {
        handleClick(event, protyle, ids, elements, menu, clearContext, element);
    });
};

const filterAI = (element: HTMLElement, inputElement: HTMLInputElement) => {
    element.querySelectorAll(".b3-list-item").forEach(item => {
        const hasText = item.textContent.indexOf(inputElement.value) > -1;
        switchFnNoneByFlag(item, !hasText);
    });
    element.querySelectorAll(".b3-menu__separator").forEach(item => {
        switchFnNoneByFlag(item, !!inputElement.value);
    });
    element.querySelector(".b3-list-item--focus").classList.remove("b3-list-item--focus");
    element.querySelector(".b3-list-item:not(.fn__none)").classList.add("b3-list-item--focus");
};
export const AIActions = (elements: Element[], protyle: IProtyle) => {
    window.siyuan.menus.menu.remove();
    const ids = getElementsBlockId(elements)
    const menu = new Menu("ai", () => {
        focusByRange(protyle.toolbar.range);
    });
    
    // 使用独立函数生成自定义菜单项HTML
    const customHTML = generateCustomMenuItems();
    const clearContext = "Clear context";
    
    // 使用独立函数生成菜单HTML模板
    const menuHTML = generateMenuHTML(customHTML);
    
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
    
    menu.element.querySelector(".b3-menu__items").setAttribute("style", "overflow: initial");
    /// #if MOBILE
    menu.fullscreen();
    /// #else
    const rect = elements[elements.length - 1].getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
    });
    menu.element.querySelector("input").focus();
    /// #endif
};
