/**
 * 用途：类名匹配查找
 * 使用范围：查找 av__row、选中状态检查
 * 解耦评估：通过 imports.ts 转发
 */
import {hasClosestByClassName} from "./imports";
/**
 * 用途：查找嵌入块
 * 使用范围：ctrl 选中时定位嵌入块
 * 解耦评估：通过 imports.ts 转发
 */
import {isInEmbedBlock} from "./imports";
/**
 * 用途：清除多选状态
 * 使用范围：ctrl 选中前清除已有选中
 * 解耦评估：通过 imports.ts 转发
 */
import {clearSelect} from "./imports";
/**
 * 用途：属性视图行选中
 * 使用范围：ctrl+click 在属性视图中选中行
 * 解耦评估：通过 imports.ts 转发
 */
import {selectRow} from "./imports";
/**
 * 用途：获取最顶层独立块元素
 * 使用范围：ctrl 选中时提升到顶层块
 * 解耦评估：同层模块直接导入
 */
import {getTopAloneElement} from "./getBlock";
/**
 * 用途：统计字数
 * 使用范围：选中或取消选中后更新状态栏
 * 解耦评估：通过 imports.ts 转发
 */
import {countBlockWord} from "./imports";
/**
 * 用途：meta 键检测
 * 使用范围：判断 ctrl/cmd 键
 * 解耦评估：通过 imports.ts 转发
 */
import {isOnlyMeta} from "./imports";

/** 清除单个元素的选中样式和属性 */
function clearElementSelect(element: Element) {
    element.classList.remove("protyle-wysiwyg--select");
    element.removeAttribute("select-start");
    element.removeAttribute("select-end");
}

/** 处理 gallery 或 av 行的 ctrl 多选 */
function handleGalleryOrRow(galleryItemElement: HTMLElement | false, rowElement: false | Element) {
    if (galleryItemElement) {
        galleryItemElement.classList.toggle("av__gallery-item--select");
        return;
    }
    if (!rowElement) {
        return;
    }
    const firstColumn = rowElement.querySelector(".av__firstcol");
    if (firstColumn) {
        selectRow(firstColumn, "toggle");
    }
}

/**
 * 处理 ctrl+click 模式下对单个块的选中/取消选中切换。
 * 根据当前是否有选中类决定移除还是添加样式。
 * @param {object} ctx 切换上下文，含 protyle, ctrlElement, wysiwygElement
 * @同步豁免: 需要绝对同步的DOM访问 — 点击事件处理器，需同步返回以控制事件传播
 */
function handleCtrlToggle(ctx: {
    protyle: IProtyle;
    ctrlElement: HTMLElement;
    wysiwygElement: HTMLElement;
}) {
    const {protyle, ctrlElement, wysiwygElement} = ctx;
    clearSelect(["row", "galleryItem"], wysiwygElement);
    const embedBlockElement = isInEmbedBlock(ctrlElement);
    let toggleElement = embedBlockElement || ctrlElement;
    const aloneElement = getTopAloneElement(toggleElement);
    toggleElement = aloneElement instanceof HTMLElement ? aloneElement : toggleElement;
    // 检查当前元素是否已选中，是则取消选中，否则添加选中
    if (toggleElement.classList.contains("protyle-wysiwyg--select")) {
        clearElementSelect(toggleElement);
        return;
    }
    toggleElement.classList.add("protyle-wysiwyg--select");
    for (const item of toggleElement.querySelectorAll(".protyle-wysiwyg--select")) {
        clearElementSelect(item);
    }
    const parentElement = toggleElement.parentElement;
    const ctrlParentElement = parentElement ? hasClosestByClassName(parentElement, "protyle-wysiwyg--select") : false;
    if (ctrlParentElement) {
        clearElementSelect(ctrlParentElement);
    }
    const ids: string[] = [];
    const wysiwyg = protyle.wysiwyg?.element;
    if (wysiwyg) {
        for (const item of wysiwyg.querySelectorAll(".protyle-wysiwyg--select")) {
            const id = item.getAttribute("data-node-id");
            if (id) {
                ids.push(id);
            }
        }
    }
    countBlockWord(ids);
}

/**
 * 处理 ctrl+click 多选逻辑。
 * 判断是否为 gallery/row 多选或普通块多选。
 * @param {object} options 点击事件上下文
 * @同步豁免: 需要绝对同步的DOM访问 — 点击事件处理器，需同步返回以控制事件传播
 */
export function handleCtrlSelect(
    protyle: IProtyle,
    options: {
        event: MouseEvent;
        target: HTMLElement;
        nodeElement: HTMLElement | false;
        hasSelectClassElement: Element | null;
        galleryItemElement: HTMLElement | false;
        wysiwygElement: HTMLElement;
    },
) {
    const {event, target, nodeElement, hasSelectClassElement, galleryItemElement, wysiwygElement} = options;
    if (!isOnlyMeta(event) || event.shiftKey || event.altKey) {
        return false;
    }
    const rowElement = hasClosestByClassName(target, "av__row");
    const rowIsValid = rowElement && !rowElement.classList.contains("av__row--header");
    const hasGalleryOrRow = !hasSelectClassElement && (galleryItemElement || rowIsValid);
    if (hasGalleryOrRow) {
        handleGalleryOrRow(galleryItemElement, rowElement);
        return true;
    }
    if (nodeElement) {
        handleCtrlToggle({protyle, ctrlElement: nodeElement, wysiwygElement});
    }
    return true;
}
