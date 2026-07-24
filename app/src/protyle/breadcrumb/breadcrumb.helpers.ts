/**
 * 面包屑模块辅助函数
 * 从 index.ts 提取的辅助函数
 */
import { getIconByType } from "../../editor/getIcon";
import { hasClosestBlock } from "../util/hasClosest";
import { isMobile, isBrowserDesktop } from "../../platform";
import { getNoContainerElement } from "../wysiwyg/getBlock";
import {isInAndroid, isInHarmony} from "../util/compatibility";
import {isMac, updateHotkeyTip} from "../../util/platform/hotkey/format";
import {isIPad} from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// ==================== 块元素相关 ====================

/**
 * 获取当前焦点所在的块元素
 */
export function 查找焦点块元素(protyle: IProtyle): Element | null {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const wysiwygElement = protyle.wysiwyg?.element;
    if (!wysiwygElement) {
        return null;
    }
    const isContainer = wysiwygElement.isEqualNode(range.startContainer) ||
        wysiwygElement.contains(range.startContainer);

    if (isContainer) {
        return hasClosestBlock(range.startContainer) || null;
    }

    if (protyle.element.id === "searchPreview") {
        // https://github.com/siyuan-note/siyuan/issues/8807
        const searchMark = wysiwygElement.querySelector('[data-type="search-mark"]');
        return searchMark ? (hasClosestBlock(searchMark) || null) : null;
    }
    return null;
}

/**
 * 获取默认块元素（当无法找到焦点块时使用）
 */
export function 获取默认块元素(protyle: IProtyle): Element {
    const wysiwygElement = protyle.wysiwyg?.element;
    if (!wysiwygElement) {
        throw new Error("protyle.wysiwyg.element 不存在");
    }
    const firstChild = wysiwygElement.firstElementChild;
    if (!firstChild) {
        return wysiwygElement;
    }
    return getNoContainerElement(firstChild) || firstChild;
}

/**
 * 确定要用于渲染的块元素
 */
export function 确定渲染块元素(protyle: IProtyle, nodeElement?: Element | false): Element | null {
    if (nodeElement && !nodeElement.classList.contains("list")) {
        return nodeElement;
    }
    return 查找焦点块元素(protyle);
}

// ==================== 面包屑状态相关 ====================

/**
 * 确定当前面包屑项是否为活动项
 */
export function 判断是否为当前项(protyle: IProtyle, itemId: string): boolean {
    if (!protyle.block.showAll && itemId === protyle.block.parentID) {
        return true;
    }
    if (protyle.block.showAll && itemId === protyle.block.id) {
        return true;
    }
    return false;
}

/**
 * 更新面包屑活动状态
 */
export function 更新活动状态(protyle: IProtyle) {
    const breadcrumbElement = protyle.breadcrumb?.element;
    if (!breadcrumbElement) {
        return;
    }
    const items = breadcrumbElement.querySelectorAll(".protyle-breadcrumb__item--active");
    for (const item of items) {
        item.classList.remove("protyle-breadcrumb__item--active");
    }
    const targetId = protyle.block.showAll ? protyle.block.id : protyle.block.parentID;
    const currentElement = breadcrumbElement.querySelector(`[data-node-id="${targetId}"]`);
    if (currentElement) {
        currentElement.classList.add("protyle-breadcrumb__item--active");
    }
}

/**
 * 获取面包屑排除的类型列表
 */
export function 获取排除类型(element: HTMLElement): string[] {
    const excludeTypes: string[] = [];
    if (element.parentElement?.parentElement?.classList.contains("card__block")) {
        excludeTypes.push("NodeTextMark-mark");
    }
    return excludeTypes;
}

// ==================== HTML 生成相关 ====================

/**
 * 生成单个面包屑项的 HTML
 */
export function 生成面包屑项HTML(
    protyle: IProtyle,
    item: IBreadcrumb,
    index: number,
    total: number
): string {
    const isCurrent = 判断是否为当前项(protyle, item.id);
    const isFirst = index === 0;
    const isOnly = total === 1;
    const needMaxWidth = isOnly || isFirst;

    const shouldHideDocName = isFirst && !protyle.options?.render?.breadcrumbDocName;
    const nameHtml = shouldHideDocName ? "" :
        (item.name ? `<span class="protyle-breadcrumb__text" title="${item.name}">${item.name}</span>` : "");

    return `<span class="protyle-breadcrumb__item${isCurrent ? " protyle-breadcrumb__item--active" : ""}" data-node-id="${item.id}"${needMaxWidth ? ' style="max-width:none"' : ""}>
    <svg class="popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>
    ${nameHtml}
</span>`;
}

/**
 * 生成面包屑HTML
 */
export function 生成面包屑HTML(protyle: IProtyle, data: IBreadcrumb[]): string {
    let html = "";
    for (let index = 0; index < data.length; index++) {
        const item = data[index];
        if (!item) {
            continue;
        }
        html += 生成面包屑项HTML(protyle, item, index, data.length);
        if (index !== data.length - 1) {
            html += '<svg class="protyle-breadcrumb__arrow"><use xlink:href="#iconRight"></use></svg>';
        }
    }
    return html;
}

/**
 * 生成面包屑 HTML 模板
 */
export function 生成面包屑模板(siyuanConfig: ReturnType<typeof getSiyuanConfig>, padHTML: string): string {
    const mobileButton = `<button class="protyle-breadcrumb__icon" data-type="mobile-menu">${siyuanI18n.breadcrumb}</button>`;
    const desktopBar = '<div class="protyle-breadcrumb__bar"></div>';

    return `${isMobile ? mobileButton : desktopBar}
<span class="protyle-breadcrumb__space"></span>
<button class="protyle-breadcrumb__icon fn__none ariaLabel" aria-label="${updateHotkeyTip(siyuanConfig.keymap.editor.general.exitFocus.custom)}" data-type="exit-focus">${siyuanI18n.exitFocus}</button>
${padHTML}
<button class="block__icon fn__flex-center ariaLabel${siyuanConfig.readonly ? " fn__none" : ""}" aria-label="${siyuanI18n.lockEdit}" data-type="readonly" data-subtype="unlock"><svg><use xlink:href="#iconUnlock"></use></svg></button>
<button class="block__icon fn__flex-center ariaLabel" data-type="doc" aria-label="${isMac() ? siyuanI18n.gutterTip2 : siyuanI18n.gutterTip2.replace("⇧", "Shift+")}"><svg><use xlink:href="#iconFile"></use></svg></button>
<button class="block__icon fn__flex-center ariaLabel" data-type="more" aria-label="${siyuanI18n.more}"><svg><use xlink:href="#iconMore"></use></svg></button>
<button class="block__icon fn__flex-center fn__none ariaLabel" data-type="context" aria-label="${siyuanI18n.context}"><svg><use xlink:href="#iconAlignCenter"></use></svg></button>`;
}

/**
 * 生成平板按钮 HTML
 * @AIDONE 核查此处的条件编译书写方式是否正确
 */
export function 生成平板按钮HTML(): string {
    if (!isBrowserDesktop) {
        return "";
    }
    if (isIPad() || isInAndroid() || isInHarmony()) {
        return `<button class="block__icon fn__flex-center ariaLabel" disabled aria-label="${siyuanI18n.undo}" data-type="undo"><svg><use xlink:href="#iconUndo"></use></svg></button>
<button class="block__icon fn__flex-center ariaLabel" disabled aria-label="${siyuanI18n.redo}" data-type="redo"><svg><use xlink:href="#iconRedo"></use></svg></button>
<button class="block__icon fn__flex-center ariaLabel" disabled aria-label="${siyuanI18n.outdent}" data-type="outdent"><svg><use xlink:href="#iconOutdent"></use></svg></button>
<button class="block__icon fn__flex-center ariaLabel" disabled aria-label="${siyuanI18n.indent}" data-type="indent"><svg><use xlink:href="#iconIndent"></use></svg></button>`;
    }
    return "";
}
