/**
 * Outline 构造函数初始化逻辑
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */

import { getInstanceById } from "../../util";
import { Tab } from "../../Tab";
import { hasClosestByClassName, hasTopClosestByClassName } from "../../../protyle/util/hasClosest";
import { openFileById } from "../../../editor/utils.openFileById";
import { Constants } from "../../../constants";
import { checkFold } from "../../../util/platform/noRelyPCFunction";
import { escapeAttr } from "../../../util/DOM/escape";
import type { AppFacade } from "../../../app/AppFacade.types";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type { Outline } from "./Outline";

const FILE_ACTION_ZOOM_IN: TProtyleAction[] = [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE];
const FILE_ACTION_DEFAULT: TProtyleAction[] = [Constants.CB_GET_FOCUS, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML];

/**
 * 初始化搜索输入框事件
 * @同步豁免: DOM访问
 */
export function initInputEvents(outline: Outline) {
    const inputElement = outline.headerElement.querySelector("input.b3-text-field.search__label");
    if (!(inputElement instanceof HTMLInputElement)) {
        return;
    }
    inputElement.addEventListener("blur", () => {
        handleSearchInputBlur(outline, inputElement);
    });
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        handleSearchInputKeydown(outline, inputElement, event);
    });
}

/**
 * 处理搜索框失焦事件
 * @param outline Outline 实例
 * @param inputElement 输入框元素
 */
function handleSearchInputBlur(outline: Outline, inputElement: HTMLInputElement) {
    inputElement.classList.add("fn__none");
    const filterIconElement = inputElement.nextElementSibling;
    if (!filterIconElement) {
        return;
    }
    const value = inputElement.value;
    filterIconElement.classList.toggle("block__icon--active", !!value);
    filterIconElement.setAttribute("aria-label", value ? siyuanI18n.filter + " " + escapeAttr(value) : siyuanI18n.filter);
    // 如果输入值发生变化，则更新过滤
    if (inputElement.dataset.value !== value) {
        outline.setFilter();
    }
}

/**
 * 处理搜索框按键事件
 * @param outline Outline 实例
 * @param inputElement 输入框元素
 * @param event 键盘事件
 */
function handleSearchInputKeydown(outline: Outline, inputElement: HTMLInputElement, event: KeyboardEvent) {
    // 仅在非输入法组合状态（如中文拼音输入中）且按下回车键时触发，避免误触
    if (!event.isComposing && event.key === "Enter") {
        inputElement.dataset.value = inputElement.value;
        outline.setFilter();
    }
}


/**
 * 生成 Tree 组件配置
 * @param outline Outline 实例
 * @同步豁免: UI构建
 */
export function createTreeConfig(outline: Outline, app: AppFacade) {
    return {
        element: outline.element,
        data: [],
        /**
         * 点击回调
         * 作用：响应点击事件并转发给处理函数
         * 意图：将点击逻辑委托给 handleTreeClick
         * 调用时机：用户点击树节点时
         */
        click: (element: HTMLElement) => {
            handleTreeClick(outline, app, element);
        },
        /**
         * Ctrl+点击回调
         * 作用：响应 Ctrl+点击
         * 意图：委托给 handleTreeCtrlClick
         * 调用时机：用户按住 Ctrl 点击时
         */
        ctrlClick: (element: HTMLElement, event: MouseEvent) => {
            handleTreeCtrlClick(outline, app, element, event);
        },
        /**
         * Alt+点击回调
         * 作用：响应 Alt+点击
         * 意图：委托给 handleTreeAltClick
         * 调用时机：用户按住 Alt 点击时
         */
        altClick: (element: HTMLElement, event: MouseEvent) => {
            handleTreeAltClick(outline, element, event);
        },
        /**
         * 右键点击回调
         * 作用：显示菜单
         * 意图：调用 showContextMenu
         * 调用时机：用户右键点击时
         */
        rightClick: (element: HTMLElement, event: MouseEvent) => {
            outline.showContextMenu(element, event);
        },
        /**
         * 折叠点击回调
         * 作用：响应折叠操作
         * 意图：委托给 handleTreeToggleClick
         * 调用时机：点击折叠图标时
         */
        toggleClick: (liElement: HTMLElement) => {
            handleTreeToggleClick(outline, liElement);
        }
    };
}

/**
 * 处理 Tree 点击事件
 * 意图：响应用户点击 Tree 节点的行为，根据预览模式或编辑模式执行不同操作
 * 调用时机：Tree 组件被点击时
 * @param outline Outline 实例
 * @param app AppFacade 实例
 * @param element 被点击的节点元素
 */
function handleTreeClick(outline: Outline, app: AppFacade, element: HTMLElement) {
    const id = element.getAttribute("data-node-id");
    // 如果没有 ID 则不处理
    if (!id) {
        return;
    }
    // 如果是预览模式
    if (outline.isPreview) {
        handlePreviewClick(outline, app, id);
        return;
    }
    // 处理编辑模式点击: 检查是否折叠并打开节点
    checkFold(id, (zoomIn) => {
        openEditorNode(app, id, zoomIn);
    });
}

/**
 * 处理预览模式下的点击逻辑
 * 意图：在预览模式下定位到对应的文档位置或打开文件
 * 调用时机：handleTreeClick 在 isPreview 为 true 时调用
 * @param outline Outline 实例
 * @param app AppFacade 实例
 * @param id 节点 ID
 */
function handlePreviewClick(outline: Outline, app: AppFacade, id: string) {
    const headElement = document.getElementById(id);
    // 如果找不到对应的 DOM 元素（即使在预览模式下也可能因为未渲染等原因找不到），则直接打开文件
    if (!headElement) {
        openFileById({ app, id: outline.blockId });
        return;
    }
    const tabElement = hasTopClosestByClassName(headElement, "protyle");
    const tabId = (tabElement instanceof Element) ? tabElement.getAttribute("data-id") : null;
    const tab = tabId ? getInstanceById(tabId) : null;
    // 确保获取到的实例是 Tab 类型
    // 检查获取到的实例是否为Tab类型
    if (tab instanceof Tab) {
        tab.parent.switchTab(tab.headElement);
    }
    headElement.scrollIntoView();
}

/**
 * 打开编辑器节点
 * @param app AppFacade 实例
 * @param id 节点 ID
 * @param zoomIn 是否放大/聚焦
 */
function openEditorNode(app: AppFacade, id: string, zoomIn: boolean) {
    openFileById({
        app,
        id,
        position: "start",
        action: zoomIn ? FILE_ACTION_ZOOM_IN : FILE_ACTION_DEFAULT,
    });
}

/**
 * 处理 Tree Ctrl+Click 事件
 * 意图：响应用户 Ctrl+点击 Tree 节点的行为，通常用于折叠/展开子节点或聚焦打开
 * 调用时机：Tree 组件被 Ctrl+点击时
 * @param outline Outline 实例
 * @param app AppFacade 实例
 * @param element 被点击的节点元素
 * @param event 鼠标事件对象
 */
function handleTreeCtrlClick(outline: Outline, app: AppFacade, element: HTMLElement, event: MouseEvent) {
    const target = event.target;
    // 确保点击目标是 Element
    if (!(target instanceof Element)) {
        return;
    }
    const arrowElement = hasClosestByClassName(target, "b3-list-item__toggle");
    // 判断点击的是否为折叠箭头且未隐藏，如果是则执行折叠/展开子节点操作
    if (arrowElement && !arrowElement.classList.contains("fn__hidden")) {
        outline.collapseChildren(element);
        return;
    }
    const id = element.getAttribute("data-node-id");
    // 如果存在节点 ID，则聚焦打开
    if (id) {
        openFileById({ app, id, action: [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML], zoomIn: true });
    }
}

/**
 * 处理 Tree Alt+Click 事件
 * 意图：响应用户 Alt+点击 Tree 节点的行为，通常用于折叠/展开同级节点
 * 调用时机：Tree 组件被 Alt+点击时
 * @param outline Outline 实例
 * @param element 被点击的节点元素
 * @param event 鼠标事件对象
 */
function handleTreeAltClick(outline: Outline, element: HTMLElement, event: MouseEvent) {
    const target = event.target;
    // 确保点击目标是 HTMLElement
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const arrowElement = hasClosestByClassName(target, "b3-list-item__toggle");
    // 仅当点击的是折叠箭头时才处理同级折叠
    if (arrowElement) {
        outline.collapseSameLevel(element);
    }
}

/**
 * 处理 Tree 折叠/展开点击事件
 * 意图：响应用户点击折叠/展开箭头及其后续列表的显示/隐藏，并保存展开状态
 * 调用时机：Tree 组件的 toggleClick 回调
 * @param outline Outline 实例
 * @param liElement 被点击的 LI 元素
 */
function handleTreeToggleClick(outline: Outline, liElement: HTMLElement) {
    const nextSibling = liElement.nextElementSibling;
    // 如果没有下一个兄弟节点（即没有子列表），则直接返回
    if (!nextSibling) {
        return;
    }
    const toggleElement = liElement.firstElementChild;
    const svgElement = toggleElement ? toggleElement.firstElementChild : null;
    // 如果找不到箭头图标元素，则不处理
    if (!svgElement) {
        return;
    }

    const isOpen = svgElement.classList.contains("b3-list-item__arrow--open");
    // 如果当前处于展开状态，则执行收起操作
    if (isOpen) {
        svgElement.classList.remove("b3-list-item__arrow--open");
        nextSibling.classList.add("fn__none");
        toggleNextNextUl(nextSibling, false);
        outline.saveExpendIds();
        return;
    }
    svgElement.classList.add("b3-list-item__arrow--open");
    nextSibling.classList.remove("fn__none");
    toggleNextNextUl(nextSibling, true);
    outline.saveExpendIds();
}

/**
 * 切换下下个 UL 兄弟节点的显示状态
 * 意图：处理由此节点控制的深层嵌套列表的显示/隐藏（主要是处理可能的嵌套列表层级显示）
 * 调用时机：handleTreeToggleClick 中
 * @param nextSibling 下一个兄弟节点
 * @param show 是否显示
 */
function toggleNextNextUl(nextSibling: Element, show: boolean) {
    const nextNextSibling = nextSibling.nextElementSibling;
    // 检查是否存在后续相邻的 UL 列表（可能是某种特殊结构下的连续列表），如果有则同步其显隐状态
    if (!nextNextSibling || nextNextSibling.tagName !== "UL") {
        return;
    }
    nextNextSibling.classList.toggle("fn__none", !show);
}
