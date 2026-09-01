import { getAllEditor } from "../../layout/getAll";
import {hideRectResizeHandles} from "../../asset/rectAnnotationResize";
import {isIPhone} from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {hideGutterElements} from "./gutterVisibility";
import {closeSubElement} from "../toolbar/subElementLifecycle";
import {hideAllGutters} from "./hideGutters";

/**
 * 思源编辑器面板类型枚举
 *
 *
 * @description 定义了可以隐藏的各种思源编辑器界面元素类型：
 * - "gutter": 行号栏和折叠控件区域
 * - "toolbar": 编辑器工具栏
 * - "select": 文本选择状态
 * - "hint": 提示框
 * - "util": 实用工具栏
 * - "dialog": 对话框
 * - "gutterOnly": 仅隐藏行号栏（保留高亮功能）
 */
type panelsItemType = "gutter" | "toolbar" | "select" | "hint" | "util" | "dialog" | "gutterOnly"

/**
 * 面板类型数组
 *
 * @description 包含一个或多个面板类型的数组，用于批量指定需要隐藏的界面元素
 */
type panelsType = panelsItemType[]

/**
 * 隐藏指定思源编辑器的界面元素
 *
 * @description 根据传入的面板类型数组，隐藏指定编辑器实例中的相应界面元素。
 *              此函数主要用于编辑器状态切换时的界面清理，如进入全屏模式、
 *              切换编辑模式或执行特定操作时临时隐藏干扰元素。
 *
 *
 * @example
 * // 隐藏单个编辑器的工具栏和行号栏
 * hideElements(["toolbar", "gutter"], protyleInstance);
 *
 * @example
 * // 仅关闭所有对话框（无需编辑器实例）
 * hideElements(["dialog"]);
 */
export const hideElements = (panels: panelsType, protyle?: IProtyle, focusHide = false) => {
    if (!protyle) {
        if (panels.includes("dialog")) {
            const dialogLength = window.siyuan.dialogs.length;
            for (let i = 0; i < dialogLength; i++) {
                window.siyuan.dialogs[i]?.destroy();
            }
        }
        return;
    }
    if (panels.includes("hint")) {
        clearTimeout(protyle.hint?.timeId);
        protyle.hint?.deactivateEmojiPanel();
        protyle.hint?.element.classList.add("fn__none");
    }
    if (protyle.gutter && panels.includes("gutter")) {
        protyle.gutter.element.classList.add("fn__none");
        protyle.gutter.element.innerHTML = "";
        // https://ld246.com/article/1651935412480
        protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--hl").forEach((item) => {
            item.classList.remove("protyle-wysiwyg--hl");
        });
    }
    //  不能 remove("protyle-wysiwyg--hl") 否则打开页签的时候 "cb-get-hl" 高亮会被移除
    if (panels.includes("gutterOnly")) {
        const gutterElements: HTMLElement[] = [];
        if (protyle.gutter) {
            gutterElements.push(protyle.gutter.element);
        }
        const nestedGutter = protyle.contentElement.querySelector<HTMLElement>(".protyle-gutters:not(.fn__none)");
        if (nestedGutter) {
            gutterElements.push(nestedGutter);
        }
        hideGutterElements(gutterElements, !isIPhone());
    }
    if (protyle.toolbar && panels.includes("toolbar")) {
        protyle.toolbar.element.classList.add("fn__none");
        protyle.toolbar.element.style.display = "";
    }
    if (protyle.toolbar && panels.includes("util")) {
        const pinElement = protyle.toolbar.subElement.querySelector('[data-type="pin"]');
        if (!protyle.toolbar.isMultiSelectMode() &&
            (focusHide || !pinElement || (pinElement && pinElement.getAttribute("aria-label") === siyuanI18n.pin))) {
            protyle.toolbar.subElement.classList.add("fn__none");
            closeSubElement(protyle.toolbar);
        }
    }
    if (panels.includes("select")) {
        protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select").forEach(item => {
            item.classList.remove("protyle-wysiwyg--select");
            item.removeAttribute("select-start");
            item.removeAttribute("select-end");
        });
    }
};

/**
 * 隐藏所有编辑器实例中的指定界面元素
 *
 * @description 全局隐藏所有打开的编辑器实例中的特定界面元素。
 *              此函数主要用于应用级别的界面状态管理，如进入全屏模式、
 *              执行全局操作或切换应用状态时批量清理界面。
 *              与 hideElements 不同，此函数作用于所有编辑器实例而非单个实例。
 *
 * @param  types - 需要隐藏的元素类型数组
 *
 * @example
 * // 隐藏所有编辑器的工具栏和行号栏
 * hideAllElements(["toolbar", "gutter"]);
 *
 * @example
 * // 进入全屏模式时隐藏所有干扰元素
 * hideAllElements(["toolbar", "util", "pdfutil", "gutter"]);
 */
export const hideAllElements = (types: string[]) => {
    if (types.includes("toolbar")) {
        document.querySelectorAll(".protyle-toolbar").forEach((item) => {
            if (item instanceof HTMLElement) {
                item.classList.add("fn__none");
                item.style.display = "";
            }
        });
    }
    if (types.includes("util")) {
        getAllEditor().forEach(item => {
            if (item.protyle.toolbar) {
                const pinElement = item.protyle.toolbar.subElement.querySelector('[data-type="pin"]');
                if (!item.protyle.toolbar.isMultiSelectMode() &&
                    (!pinElement || (pinElement && pinElement.getAttribute("aria-label") === siyuanI18n.pin))) {
                    item.protyle.toolbar.subElement.classList.add("fn__none");
                    closeSubElement(item.protyle.toolbar);
                }
            }
        });
    }
    if (types.includes("pdfutil")) {
        document.querySelectorAll(".pdf__util").forEach(item => {
            item.classList.add("fn__none");
        });
        hideRectResizeHandles(document);
    }
    if (types.includes("gutter")) {
        hideAllGutters();
    }
};
