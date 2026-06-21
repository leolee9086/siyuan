import { hasClosestByAttribute, isInEmbedBlock } from "../util/hasClosest";
import { removeSearchMark } from "../toolbar/util";
import { refMenu } from "../../menus/protyleMenus/refMenu/protyle.refMenu";
import { fileAnnotationRefMenu } from "../../menus/protyleMenus/refMenu/protyle.fileAnnotationRefMenu";
import { linkMenu } from "../../menus/protyleMenus/linkMenu/protyle.linkMenu";
import { tagMenu } from "../../menus/protyleMenus/refMenu/protyle.tagMenu";
import { inlineMathMenu } from "../../menus/protyleMenus/editorMenu/protyle.inlineMathMenu";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { hasPreviousSibling } from "./getBlock";
import { matchHotKey } from "../util/hotKey";
import { getSelectionPosition } from "../util/selection";

/**
 * 处理内联元素菜单快捷键中间件
 * 处理"⌘/"快捷键，根据光标位置和选中的内联元素类型显示相应的上下文菜单
 */
export const inlineMenuMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
): Promise<void> => {
    if (!matchHotKey("⌘/", event) || isInEmbedBlock(nodeElement)) {
        return;
    }

    event.stopPropagation();
    event.preventDefault();

    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));

    // 如果没有选中元素，检查光标位置的内联元素
    if (selectElements.length === 0) {
        const inlineElement = hasClosestByAttribute(range.startContainer, "data-type", null);
        if (inlineElement && inlineElement.tagName === "SPAN") {
            const types = inlineElement.getAttribute("data-type").split(" ");
            if (types.length > 0) {
                protyle.toolbar.range = range;
                removeSearchMark(inlineElement);
            }

            // 根据内联元素类型显示相应菜单
            if (types.includes("block-ref")) {
                refMenu(protyle, inlineElement);
                controller.abort("块引用菜单已显示");
                return;
            } else if (types.includes("inline-memo")) {
                protyle.toolbar.showRender(protyle, inlineElement);
                controller.abort("内联备注菜单已显示");
                return;
            } else if (types.includes("file-annotation-ref")) {
                fileAnnotationRefMenu(protyle, inlineElement, getSiyuanGlobalMenus().menu);
                controller.abort("文件标注引用菜单已显示");
                return;
            } else if (types.includes("a")) {
                linkMenu(protyle, inlineElement);
                controller.abort("链接菜单已显示");
                return;
            } else if (types.includes("tag")) {
                tagMenu(protyle, inlineElement);
                controller.abort("标签菜单已显示");
                return;
            }
        }

        // 检查光标前的内联数学公式
        // https://github.com/siyuan-note/siyuan/issues/5185
        if (range.startOffset === 0 && range.startContainer.nodeType === 3) {
            const previousSibling = hasPreviousSibling(range.startContainer) as HTMLElement;
            if (previousSibling &&
                previousSibling.nodeType !== 3 &&
                previousSibling.getAttribute("data-type")?.indexOf("inline-math") > -1
            ) {
                inlineMathMenu(protyle, previousSibling);
                controller.abort("内联数学公式菜单已显示");
                return;
            } else if (!previousSibling &&
                range.startContainer.parentElement.previousSibling &&
                range.startContainer.parentElement.previousSibling === range.startContainer.parentElement.previousElementSibling &&
                range.startContainer.parentElement.previousElementSibling.getAttribute("data-type")?.indexOf("inline-math") > -1
            ) {
                inlineMathMenu(protyle, range.startContainer.parentElement.previousElementSibling);
                controller.abort("内联数学公式菜单已显示");
                return;
            }
        }

        // 如果没有内联元素，则将当前块作为选中元素
        selectElements.push(nodeElement);
    }

    // 显示块菜单
    if (selectElements.length === 1) {
        protyle.gutter.renderMenu(protyle, selectElements[0]);
    } else {
        protyle.gutter.renderMultipleMenu(protyle, selectElements);
    }

    const rect = nodeElement.getBoundingClientRect();
    window.siyuan.menus.menu.popup({ x: rect.left, y: rect.top, isLeft: true });
    controller.abort("内联菜单已显示");
};

export const contextMenuMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (event.key === "ContextMenu") {
        const rangePosition = getSelectionPosition(nodeElement, range);
        protyle.wysiwyg.element.dispatchEvent(new CustomEvent("contextmenu", {
            detail: {
                target: nodeElement,
                y: rangePosition.top + 8,
                x: rangePosition.left
            }
        }));
        event.preventDefault();
        event.stopPropagation();
        controller.abort("上下文菜单键");
        return;
    }
};
