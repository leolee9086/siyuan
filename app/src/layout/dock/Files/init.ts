/**
 * @fileoverview Files 组件初始化逻辑模块
 *
 * @description
 * 本模块包含文件树初始化相关的纯函数，从 Files.ts 的 init 方法中拆分而来。
 * 所有函数都采用纯函数模式，将依赖作为参数传递。
 */

import { Constants } from "../../../constants";
import { getSiyuanNotebooks, getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { genNotebook } from "./htmlGenerators";
import type { NotebooksHtmlResult, SelectItemFn, InitPanelResult } from "./eventHandlers.types";

/**
 * 生成笔记本HTML
 *
 * @同步豁免: UI构建 - 此函数用于同步生成HTML字符串，是纯计算函数，
 * 不涉及任何异步操作，且需要在同步的init流程中使用
 *
 * @description
 * 作用：遍历所有笔记本，分别生成打开和关闭笔记本的HTML
 * 意图：将笔记本数据转换为可渲染的HTML字符串
 * 调用时机：初始化文件树时调用
 *
 * @returns 包含打开/关闭笔记本HTML和关闭计数的结果对象
 */
export function generateNotebooksHtml(): NotebooksHtmlResult {
    let openHtml = "";
    let closeHtml = "";
    let closeCounter = 0;
    const notebooks = getSiyuanNotebooks();

    for (const item of notebooks) {
        // 已关闭的笔记本放入关闭区域
        if (item.closed) {
            closeCounter++;
            closeHtml += genNotebook(item);
            continue;
        }
        openHtml += genNotebook(item);
    }

    return { openHtml, closeHtml, closeCounter };
}

/**
 * 更新关闭区域的DOM内容
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 此函数直接操作DOM元素，
 * 需要在同步的init流程中立即更新UI，异步会导致UI闪烁
 *
 * @description
 * 作用：更新关闭笔记本区域的HTML内容和计数器显示
 * 意图：将生成的HTML渲染到DOM中
 * 调用时机：初始化文件树时调用
 *
 * @param closeElement - 关闭笔记本区域的容器元素
 * @param closeHtml - 关闭笔记本的HTML字符串
 * @param closeCounter - 关闭笔记本的数量
 */
export function updateCloseAreaContent(
    closeElement: HTMLElement,
    closeHtml: string,
    closeCounter: number
): void {
    const closeLastChild = closeElement.lastElementChild;
    // closeLastChild 在构造函数中已确保存在
    if (closeLastChild) {
        closeLastChild.innerHTML = closeHtml;
    }

    const counterElement = closeElement.querySelector(".counter");
    // counterElement 在构造函数中已确保存在
    if (counterElement) {
        counterElement.textContent = closeCounter.toString();
    }
}

/**
 * 更新关闭区域的可见性
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 此函数直接操作DOM类名，
 * 需要在同步的init流程中立即更新可见性，异步会导致UI闪烁
 *
 * @description
 * 作用：根据关闭笔记本数量决定是否显示关闭区域
 * 意图：当没有关闭的笔记本时隐藏该区域
 * 调用时机：初始化文件树时调用
 *
 * @param closeElement - 关闭笔记本区域的容器元素
 * @param closeCounter - 关闭笔记本的数量
 */
export function updateCloseAreaVisibility(
    closeElement: HTMLElement,
    closeCounter: number
): void {
    // 根据是否有关闭的笔记本决定是否显示关闭区域
    if (closeCounter) {
        closeElement.classList.remove("fn__none");
        return;
    }
    // 没有关闭的笔记本时隐藏关闭区域
    closeElement.classList.add("fn__none");
}

/**
 * 恢复已保存的打开路径
 *
 * @同步豁免: 遗留代码 - 此函数需要同步遍历存储数据并调用selectItem，
 * 虽然selectItem是异步的，但此处不需要等待其完成，
 * 是fire-and-forget模式，保持同步签名以兼容现有调用方式
 *
 * @description
 * 作用：从存储中读取之前打开的路径，并在文件树中选中它们
 * 意图：保持用户上次的文件树展开状态
 * 调用时机：初始化文件树时调用
 *
 * @param selectItem - 选择文件项的函数
 */
export function restoreOpenPaths(selectItem: SelectItemFn): void {
    const storage = getSiyuanStorage();
    const filesPaths = storage[Constants.LOCAL_FILESPATHS];

    for (const item of filesPaths) {
        for (const openPath of item.openPaths) {
            selectItem(item.notebookId, openPath, undefined, false, false);
        }
    }
}

/**
 * 调整关闭区域的高度和展开状态
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 此函数直接操作DOM样式和类名，
 * 需要在同步的init流程中立即调整布局，异步会导致UI闪烁和布局跳动
 *
 * @description
 * 作用：根据是否有打开的笔记本，调整关闭笔记本区域的高度和展开/折叠状态
 * 意图：优化UI布局，有打开笔记本时折叠关闭区域，否则展开
 * 调用时机：初始化文件树时调用（仅在 init=true 时）
 *
 * @param closeElement - 关闭笔记本区域的容器元素
 * @param hasOpenNotebooks - 是否有打开的笔记本
 */
export function adjustCloseAreaHeight(
    closeElement: HTMLElement,
    hasOpenNotebooks: boolean
): void {
    const svgElement = closeElement.querySelector("svg");
    const closeLastChild = closeElement.lastElementChild;

    // 有打开的笔记本时，折叠关闭笔记本区域
    if (hasOpenNotebooks) {
        closeElement.style.height = "30px";
        svgElement?.classList.remove("b3-list-item__arrow--open");
        closeLastChild?.classList.add("fn__none");
        return;
    }

    // 没有打开的笔记本时，展开关闭笔记本区域
    closeElement.style.height = "40%";
    svgElement?.classList.add("b3-list-item__arrow--open");
    closeLastChild?.classList.remove("fn__none");
}

/**
 * 生成文件树面板的HTML模板
 *
 * @同步豁免: UI构建 - 此函数用于同步生成HTML字符串，是纯计算函数
 *
 * @description
 * 作用：生成文件树面板的完整HTML结构，包括工具栏和关闭笔记本区域
 * 意图：将HTML模板生成逻辑从构造函数中分离，减少构造函数行数
 * 调用时机：Files构造函数中调用
 *
 * @param i18n - 国际化文本对象
 * @param config - 配置对象
 * @param updateHotkeyTip - 更新快捷键提示的函数
 * @returns 面板HTML字符串
 */
export function generatePanelHtml(
    i18n: { fileTree: string; selectOpen1: string; collapse: string; more: string; min: string; closeNotebook: string },
    config: { readonly: boolean; keymap: { general: { selectOpen1: { custom: string }; closeTab: { custom: string } }; editor: { general: { collapse: { custom: string } } } } },
    updateHotkeyTip: (hotkey: string) => string
): string {
    return `<div class="block__icons">
    <div class="block__logo fn__flex-1">${i18n.fileTree}</div>
    <span class="fn__flex-1 fn__space"></span>
    <span data-type="focus" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${i18n.selectOpen1}${updateHotkeyTip(config.keymap.general.selectOpen1.custom)}"><svg><use xlink:href='#iconFocus'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${i18n.collapse}${updateHotkeyTip(config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <div class="fn__space${config.readonly ? " fn__none" : ""}"></div>
    <div data-type="more" class="b3-tooltips b3-tooltips__sw block__icon${config.readonly ? " fn__none" : ""}" aria-label="${i18n.more}">
        <svg><use xlink:href="#iconMore"></use></svg>
    </div>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${i18n.min}${updateHotkeyTip(config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="fn__flex-1" style="padding-top: 2px;" data-tooltips-delay="200"></div>
<ul class="b3-list fn__flex-column" style="min-height: auto;height:30px;transition: height  .2s cubic-bezier(0, 0, .2, 1) 0ms">
    <li class="b3-list-item" data-type="toggle">
        <span class="b3-list-item__toggle">
            <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
        </span>
        <span class="b3-list-item__text">${i18n.closeNotebook}</span>
        <span class="counter" style="cursor: auto"></span>
    </li>
    <ul class="fn__none fn__flex-1"></ul>
</ul>`;
}

/**
 * 初始化面板DOM结构
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 此函数直接操作DOM元素，
 * 需要在同步的构造函数流程中立即设置DOM结构
 *
 * @description
 * 作用：设置面板的HTML结构并返回DOM元素引用
 * 意图：将DOM初始化逻辑从构造函数中分离，减少构造函数行数
 * 调用时机：Files构造函数中调用
 *
 * @param panelElement - 面板容器元素
 * @param i18n - 国际化文本对象
 * @param config - 配置对象
 * @param updateHotkeyTip - 更新快捷键提示的函数
 * @param assertElement - 断言元素存在的函数
 * @returns 包含三个关键DOM元素引用的对象
 */
export function initPanel(
    panelElement: HTMLElement,
    i18n: { fileTree: string; selectOpen1: string; collapse: string; more: string; min: string; closeNotebook: string },
    config: { readonly: boolean; keymap: { general: { selectOpen1: { custom: string }; closeTab: { custom: string } }; editor: { general: { collapse: { custom: string } } } } },
    updateHotkeyTip: (hotkey: string) => string,
    assertElement: (element: Element | null, context: string) => HTMLElement
): InitPanelResult {
    panelElement.classList.add("fn__flex-column", "file-tree", "sy__file", "dockPanel");
    panelElement.innerHTML = generatePanelHtml(i18n, config, updateHotkeyTip);

    const actionsElement = assertElement(panelElement.firstElementChild, "initPanel.actionsElement");
    const element = assertElement(actionsElement.nextElementSibling, "initPanel.element");
    const closeElement = assertElement(panelElement.lastElementChild, "initPanel.closeElement");

    return { actionsElement, element, closeElement };
}
