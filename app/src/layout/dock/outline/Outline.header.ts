/**
 * Outline 头部按钮事件
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { Tab } from "../../Tab";
import { openFileById } from "../../../editor/utils.openFileById";
import { setPanelFocus } from "../../utils/setPanelFocus";
import { goHome } from "../../../protyle/wysiwyg/commonHotkey/commonHotkey";
import { Editor } from "../../../editor";
import type { AppFacade } from "../../../app/AppFacade.types";
import type { Outline } from "./Outline";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { Model } from "../../Model";
import { handleKeepCurrentExpandClick } from "./Outline.header.expand";
import { handlePanelIconClick } from "./Outline.header.icon";

/**
 * 作用：初始化头部按钮事件。
 * 意图：作为入口函数，分别初始化折叠/展开、保持当前展开、面板点击等事件，保持代码结构清晰。
 * 调用时机：Outline 组件初始化时。
 * @param outline Outline 实例
 * @param options 配置选项
 * @同步豁免: UI构建
 */
export function initHeaderEvents(outline: Outline, options: { app: AppFacade, tab: Tab, blockId: string, type: "pin" | "local", isPreview: boolean }) {
    initCollapseExpandEvents(outline, options);
    initKeepCurrentExpandEvent(outline, options);
    // 初始化面板点击事件
    options.tab.panelElement.addEventListener("click", (event: MouseEvent) => {
        handlePanelClick(outline, options, event);
    });
}

/**
 * 作用：初始化折叠和展开按钮的点击事件。
 * 意图：为面板上的“全部折叠”和“全部展开”按钮绑定点击处理函数。
 * 调用时机：initHeaderEvents 被调用时。
 */
function initCollapseExpandEvents(outline: Outline, options: { tab: Tab }) {
    // 全部折叠
    const collapseElement = options.tab.panelElement.querySelector('[data-type="collapse"]');
    /**
     * 作用：检查元素是否存在且为 HTMLElement。
     * 意图：确保在添加事件监听器之前，DOM 元素已经正确获取。
     * 生效场景：成功查找到 data-type="collapse" 的元素时。
     */
    if (isHTMLElement(collapseElement)) {
        collapseElement.addEventListener("click", () => {
            outline.tree.collapseAll();
            outline.saveExpendIds();
        });
    }

    // 全部展开
    const expandElement = options.tab.panelElement.querySelector('[data-type="expand"]');
    /**
     * 作用：检查元素是否存在且为 HTMLElement。
     * 意图：确保在添加事件监听器之前，DOM 元素已经正确获取。
     * 生效场景：成功查找到 data-type="expand" 的元素时。
     */
    if (isHTMLElement(expandElement)) {
        expandElement.addEventListener("click", () => {
            outline.tree.expandAll();
            outline.saveExpendIds();
        });
    }
}

/**
 * 作用：初始化“保持当前展开”按钮的事件。
 * 意图：为“保持当前展开”按钮绑定点击事件，用于切换该功能的开关状态。
 * 调用时机：initHeaderEvents 被调用时。
 */
function initKeepCurrentExpandEvent(outline: Outline, options: { tab: Tab }) {
    // 保持当前展开
    const keepCurrentExpandElement = options.tab.panelElement.querySelector('[data-type="keepCurrentExpand"]');
    /**
     * 作用：检查元素是否存在且为 HTMLElement。
     * 意图：确保在添加事件监听器之前，DOM 元素已经正确获取。
     * 生效场景：成功查找到 data-type="keepCurrentExpand" 的元素时。
     */
    if (isHTMLElement(keepCurrentExpandElement)) {
        keepCurrentExpandElement.addEventListener("click", (event: MouseEvent) => {
            handleKeepCurrentExpandClick(outline, event);
        });
    }
}

/**
 * 作用：处理“保持当前展开”按钮的点击逻辑。
 * 意图：切换存储中的 keepCurrentExpand 状态，更新图标样式，并在开启时尝试聚焦当前块。
 * 调用时机：用户点击“保持当前展开”按钮时。
 */



/**
 * 作用：面板点击事件的处理器。
 * 意图：根据点击的目标元素类型（图标或标题），分发到不同的处理函数，并管理面板焦点。
 * 调用时机：面板被点击时。
 */
function handlePanelClick(outline: Outline, options: { app: AppFacade, tab: Tab }, event: MouseEvent) {
    if (!isHTMLElement(event.target)) {
        return;
    }
    let target: HTMLElement | null = event.target;
    /**
     * 作用：排除 INPUT 元素。
     * 意图：输入框的点击通常有其默认行为（聚焦、输入），不应触发面板的点击处理。
     * 生效场景：点击目标是 INPUT 标签。
     */
    if (target.tagName === "INPUT") {
        return;
    }
    let isFocus = true;
    // 使用 while 循环向上查找，模拟冒泡处理，直到面板根元素
    while (target && !target.isEqualNode(options.tab.panelElement)) {
        /**
         * 作用：判断是否点击了图标。
         * 意图：如果是图标，调用图标点击处理器。
         * 生效场景：点击了类名为 block__icon 的元素。
         */
        if (target.classList.contains("block__icon")) {
            handlePanelIconClick(outline, target, event);
            if (target.getAttribute("data-type") === "min") {
                isFocus = false;
            }
            break;
        }

        /**
         * 作用：判断是否点击了标题区域。
         * 意图：如果是点击了标题（headerElement 的下一个兄弟元素）或标题栏图标，打开对应文档。
         * 生效场景：outline.blockId 存在且点击目标符合选择器。
         */
        if (outline.blockId && (target === outline.headerElement.nextElementSibling || target.classList.contains("block__icons"))) {
            // 处理标题点击：在编辑器中打开对应的块文档
            openFileById({
                app: options.app,
                id: outline.blockId,
                /**
                 * 作用：文件打开后的回调。
                 * 意图：处理预览模式滚动或普通模式的光标定位。
                 * 调用时机：文件加载完成后。
                 */
                afterOpen: (model?: Model) => {
                    handleAfterOpen(outline, model);
                }
            });
            isFocus = false;
            break;
        }

        /**
         * 作用：检查是否到达 DOM 树顶层或脱离 DOM。
         * 意图：防止死循环或访问无效父节点。
         * 生效场景：当前目标没有父节点。
         */
        if (!target.parentElement) {
            break;
        }
        target = target.parentElement;
    }

    /**
     * 作用：设置面板焦点。
     * 意图：如果在非标题区域点击，通常需要让面板获得焦点以响应快捷键。
     * 生效场景：isFocus 为 true。
     */
    if (isFocus) {
        setValidPanelFocus(outline, options.tab.panelElement);
    }
}




/**
 * 作用：设置有效的面板焦点。
 * 意图：根据大纲类型（local/pin）决定焦点应该设置在哪个容器元素上。
 * 调用时机：handlePanelClick 结束且需要聚焦时。
 */
function setValidPanelFocus(outline: Outline, panelElement: HTMLElement) {
    /**
     * 作用：针对本地大纲的特殊焦点处理。
     * 意图：本地大纲可能嵌入在更深的结构中，需要聚焦父容器。
     * 生效场景：outline.type 为 "local" 且父元素结构完整。
     */
    if (outline.type === "local" && panelElement.parentElement?.parentElement) {
        setPanelFocus(panelElement.parentElement.parentElement);
        return;
    }
    setPanelFocus(panelElement);
}

/**
 * @AIDONE 修改lint规则,禁止这种全部内容就只是调用另一个函数的函数声明 (已完成: 规则已更新, 函数已内联)
 */

/**
 * 作用：打开文件后的回调处理。
 * 意图：文件打开后，根据是否预览模式，调整滚动位置或光标位置。
 * 调用时机：openFileById 完成后。
 */
function handleAfterOpen(outline: Outline, model?: Model) {
    if (!model || !(model instanceof Editor)) {
        return;
    }


    // 非预览模式，定位到开头
    goHome(model.editor.protyle);
}



/**
 * 作用：重置预览区域的滚动位置。
 * 意图：将预览区域的内容滚动到顶部。
 * 调用时机：handleAfterOpen 中预览模式下。
 */
function resetPreviewScroll(previewElement: HTMLElement) {
    const typography = previewElement.querySelector(".b3-typography");
    if (typography) {
        typography.scrollTop = 0;
    }
}
