import { isHTMLElement } from "../../util/DOM/element.guard";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMac } from "../util/compatibility";
import { hasClosestByClassName } from "../util/hasClosest";

/**
 * 处理属性视图（Attribute View）的特殊情况
 *
 * 此函数为属性视图的行生成特殊的 Gutter 按钮，包括拖拽按钮和添加按钮。
 * 它会根据编辑器状态和行类型调整按钮的可用性和提示信息。
 *
 * @param target 目标元素，通常是属性视图中的行
 * @param nodeElement 属性视图的容器元素
 * @param protyle 编辑器实例
 * @param type 元素类型
 * @returns 包含 HTML 内容和目标元素的对象，如果不是属性视图则返回 null
 */
export const handleAttributeView = (target: Element | undefined, nodeElement: Element, protyle: IProtyle, type: string | null) => {
    // 如果不是属性视图或没有目标元素，则不处理
    if (type !== "NodeAttributeView" || !target) {
        return null;
    }

    // 查找行元素
    const rowElement = hasClosestByClassName(target, "av__row");
    if (!rowElement || rowElement.classList.contains("av__row--header") || !rowElement.dataset.id) {
        return null;
    }

    // 获取属性视图主体元素
    const bodyElement = hasClosestByClassName(rowElement, "av__body");
    if (!isHTMLElement(bodyElement)) {
        return null;
    }

    // 根据操作系统设置提示标签
    let iconAriaLabel = isMac() ? siyuanI18n.rowTip : siyuanI18n.rowTip.replace("⇧", "Shift+");
    const firstBlock = rowElement.querySelector('[data-dtype="block"]');

    // 如果编辑器被禁用，调整提示标签
    if (protyle.disabled) {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.indexOf("<br"));
    }

    // 如果第一个块是分离的，调整提示标签
    if (!protyle.disabled && firstBlock?.getAttribute("data-detached") === "true") {
        iconAriaLabel = siyuanI18n.rowTip.substring(0, siyuanI18n.rowTip.lastIndexOf("<br"));
    }

    const dataNodeId = nodeElement.getAttribute("data-node-id");

    // 生成行菜单按钮（拖拽按钮）
    let html = `<button data-type="NodeAttributeViewRowMenu" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${iconAriaLabel}"><svg><use xlink:href="#iconDrag"></use></svg><span ${protyle.disabled ? "" : 'draggable="true" class="fn__grab"'}></span></button>`;

    // 如果编辑器未被禁用，添加添加按钮
    if (!protyle.disabled) {
        html = `<button data-type="NodeAttributeViewRow" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${isMac() ? siyuanI18n.addBelowAbove : siyuanI18n.addBelowAbove.replace("⌥", "Alt+")}"><svg><use xlink:href="#iconAdd"></use></svg></button>${html}`;
    }

    return { html, element: rowElement, nodeElement };
};
