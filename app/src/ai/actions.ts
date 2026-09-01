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
    getElementsBlockId,
    isDisabledFeature
} from "./imports";
import { fillContent } from "./actions.fillContent";
import { AIChat } from "./chatStream";
import { handleAIMenuItemClick } from "./actions.handleAIMenuItemClick";
import type { AIMenuContext, AIMenuRequest } from "./types";
import { customDialog } from "./customDialog";
import { filterAIMenuItems } from "./actions.filterAIMenuItems";
import { generateBuildingMenuHTML } from "./actions.generateBuildingMenuHTML";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanStorage, getSiyuanMenus } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../platform";
import {setAIActions} from "./actions.port";

/**
 * 生成单个AI菜单项的HTML
 * @param item AI菜单项数据
 * @param index 菜单项索引
 * @returns 单个菜单项的HTML字符串
 */
const generateAIMenuItemHTML = (item: { name: string, memo: string }, index: number) => {
    return `<div data-action="${escapeAttr(item.memo || item.name)}" data-position="10west" data-index="${index}" class="b3-list-item b3-list-item--narrow ariaLabel" aria-label="${escapeAriaLabel(item.memo)}">
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    <span data-type="edit" class="b3-list-item__action"><svg><use xlink:href="#iconEdit"></use></svg></span>
</div>`;
};

/**
 * 生成自定义AI菜单项的HTML
 * @returns 自定义菜单项的HTML字符串
 */
const generateCustomMenuItems = (storage: Record<string, unknown>) => {
    const localAIItems = storage[Constants.LOCAL_AI];
    if (!Array.isArray(localAIItems)) {
        throw new Error("传入的AI定义表不是有效的数组");
    }
    let customHTML = "";
    let index = 0;
    for (const item of localAIItems) {
        customHTML += generateAIMenuItemHTML(item, index++);
    }

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
 * 处理Enter键按下时的菜单项选择
 */
const 处理Enter键按下 = (
    currentElement: HTMLElement,
    protyle: IProtyle,
    ids: string[],
    elements: HTMLElement[],
    menu: Menu,
    clearContext: string
) => {
    if (currentElement.dataset.type === "custom") {
        customDialog(protyle, ids, elements);
        menu.close();
        return;
    }

    const 是AI聊天 = currentElement.dataset.action === "aiChat";
    const 第一个元素 = elements[0];
    if (是AI聊天 && !第一个元素) {
        throw new Error("目标元素不是有效的HTMLElement");
    }
    if (是AI聊天 && 第一个元素) {
        AIChat(protyle, 第一个元素);
        menu.close();
        return;
    }

    // 默认：调用AI接口
    fetchPost("/api/ai/chatGPTWithAction", {
        ids,
        action: currentElement.dataset.action
    }, (response) => {
        fillContent(protyle, response.data, elements);
    });

    if (currentElement.dataset.action === clearContext) {
        showMessage(siyuanI18n.clearContextSucc);
        return;
    }
    menu.close();
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
    const hintElement = upDownHint(listElement, event);
    if (hintElement) {
        event.stopPropagation();
    }
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    const focusedElement = listElement.querySelector<HTMLElement>(".b3-list-item--focus");
    if (!focusedElement) {
        return;
    }
    处理Enter键按下(focusedElement, protyle, ids, elements, menu, clearContext);
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

    /** 尝试处理 AI 聊天点击，成功返回 true */
    const 尝试处理AI聊天点击 = (
        currentElement: HTMLElement | null,
        elements: HTMLElement[]
    ): boolean => {
        const 是AI聊天菜单项 = currentElement?.dataset.action === "aiChat";
        if (!是AI聊天菜单项) {
            return false;
        }
        const 第一个元素 = elements[0];
        if (!第一个元素) {
            throw new Error("目标元素不是有效的HTMLElement");
        }
        AIChat(protyle, 第一个元素);
        menu.close();
        return true;
    };

    /**
     * 修复：支持 HTMLElement 和 SVGElement，使 SVGSymbol 图标能够响应点击
     */
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) {
        return;
    }

    const currentElement = target.closest(".b3-list-item") as HTMLElement;
    if (尝试处理AI聊天点击(currentElement, elements)) {
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
};

/**
 * 设置移动端样式
 * @param element 菜单元素
 */
const setupMobileStyles = (element: HTMLElement) => {
    if (isMobile) {
        element.setAttribute("style", "height: 100%;padding: 0 16px;");
        element.querySelectorAll(".b3-menu__separator").forEach(item => {
            item.remove();
        });
    }
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
        throw new Error("未能找到输入框元素");
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

const getValidSiyuanStorage = () => {
    const storage = getSiyuanStorage();
    if (!Array.isArray(storage[Constants.LOCAL_AI])) {
        console.error(storage[Constants.LOCAL_AI]);
        throw new Error(`siyuan 对象结构错误 ${Constants.LOCAL_AI}应该是一个数组`);
    }
    return storage;
};

export const openAIActionsMenu = (elements: Element[], protyle: IProtyle) => {
    // 合并上游 v3.8.0：AI 特性被禁用时直接返回（上游守卫位于 AIActions 入口，此处语义移植）
    if (isDisabledFeature("ai")) {
        return;
    }

    getSiyuanMenus()?.menu.remove();
    const ids = getElementsBlockId(elements);
    const menu = new Menu("ai", () => {
        if (protyle.toolbar?.range) {
            focusByRange(protyle.toolbar.range);
        }
    });

    // 使用独立函数生成自定义菜单项HTML
    const customHTML = generateCustomMenuItems(getValidSiyuanStorage());
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

    const menuItemsElement = menu.element.querySelector(".b3-menu__items");
    menuItemsElement?.setAttribute("style", "overflow: initial");
    if (isMobile) {
        menu.fullscreen();
        return;
    }
    // 合并上游 v3.8.0：末尾元素缺失时回退到编辑器根元素定位，避免空选区抛错中断菜单打开
    const traget = elements[elements.length - 1] as HTMLElement;
    const rect = traget?.getBoundingClientRect() || protyle.element.getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
    });
    const menuInputElement = menu.element.querySelector("input");
    menuInputElement?.focus();
};

/** 提供兼容工具栏快捷键的动作入口，并保留调用方的选区快照。 */
export const AIActions = (elements: Element[], protyle: IProtyle, range?: Range) => {
    if (range) {
        protyle.toolbar.range = range.cloneRange();
    }
    openAIActionsMenu(elements, protyle);
};

setAIActions(AIActions);
