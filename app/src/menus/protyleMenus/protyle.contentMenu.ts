import * as dayjs from "dayjs";
import { focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { isMobile } from "../../platform";
import { emitOpenMenu } from "../../plugin/EventBus";
import { copyPlainText, writeText, readClipboard } from "../../protyle/util/compatibility";
import { hasClosestByTag } from "../../protyle/util/hasClosest";
import { paste, pasteAsPlainText, pasteEscaped } from "../../protyle/util/paste";
import { getEditorRange, focusByWbr, selectAll } from "../../protyle/util/selection";
import { getProtyleToolbar, getProtyleLute } from "../../protyle/util/props.pick";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { MenuItem } from "../Menu.Item";
import { tableMenu } from "../protyle";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSelection } from "../../util/DOM/range.global";
import type { IContentMenuContext, IInlineMenuContext } from "./protyle.types";
import { isHTMLElement, isHTMLTableCellElement } from "./protyle.contentMenu.guard";


/**
 * 添加有选区时的菜单项（复制、复制纯文本、剪切、删除）
 * @returns 如果 protyle.disabled 为 true 则返回 true，表示应该提前退出
 */
const 添加选区相关菜单 = (ctx: IContentMenuContext): boolean => {
    const { protyle, nodeElement, oldHTML, id } = ctx;
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        icon: "iconCopy",
        accelerator: "⌘C",
        label: siyuanI18n.copy,
        click() {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("copy");
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
        click() {
            focusByRange(getEditorRange(nodeElement));
            copyPlainText(getSelection().getRangeAt(0).toString());
        }
    }).element);
    if (protyle.disabled) {
        return true;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        click() {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("cut");
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "delete",
        icon: "iconTrashcan",
        accelerator: "⌫",
        label: siyuanI18n.delete,
        click() {
            const currentRange = getEditorRange(nodeElement);
            currentRange.insertNode(document.createElement("wbr"));
            currentRange.extractContents();
            focusByWbr(nodeElement, currentRange);
            focusByRange(currentRange);
            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
        }
    }).element);
    return false;
};

/** 添加行内元素的复制菜单项 */
const 添加行内复制菜单 = (protyle: IProtyle, inlineElement: HTMLSpanElement): void => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        click() {
            copyPlainText(inlineElement.textContent);
        }
    }).element);
};

/** 添加行内元素的编辑菜单项（剪切、删除） */
const 添加行内编辑菜单 = (ctx: IInlineMenuContext): void => {
    const { protyle, nodeElement, range, oldHTML, inlineElement } = ctx;
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("块元素缺少id");
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        label: siyuanI18n.cut,
        click() {
            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
            inlineElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            focusByWbr(nodeElement, getProtyleToolbar(protyle).range ?? range);
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click() {
            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
            inlineElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            focusByWbr(nodeElement, getProtyleToolbar(protyle).range ?? range);
        }
    }).element);
};

/**
 * 添加无选区但在行内元素(code/kbd)上时的菜单项
 * @see https://github.com/siyuan-note/siyuan/issues/9630
 */
const 添加行内元素菜单 = (ctx: IContentMenuContext): void => {
    const { protyle, nodeElement, range, oldHTML } = ctx;
    const inlineElement = hasClosestByTag(range.startContainer, "SPAN");
    if (!inlineElement) {
        return;
    }
    const inlineTypes = getProtyleToolbar(protyle).getCurrentType(range);
    const isCodeOrKbd = inlineTypes.includes("code") || inlineTypes.includes("kbd");
    if (!isCodeOrKbd) {
        return;
    }
    添加行内复制菜单(protyle, inlineElement);
    if (protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({ type: "separator" }).element);
        return;
    }
    添加行内编辑菜单({ protyle, nodeElement, range, oldHTML, inlineElement });
    getSiyuanGlobalMenus().menu.append(new MenuItem({ type: "separator" }).element);
};

/** 添加粘贴相关菜单项 */
const 添加粘贴菜单 = (protyle: IProtyle, nodeElement: Element): void => {
    if (protyle.disabled) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "paste",
        label: siyuanI18n.paste,
        icon: "iconPaste",
        accelerator: "⌘V",
        async click() {
            focusByRange(getEditorRange(nodeElement));
            if (document.queryCommandSupported("paste")) {
                document.execCommand("paste");
                return;
            }
            try {
                const text = await readClipboard();
                const target = nodeElement as HTMLElement;
                paste(protyle, Object.assign(text, { target }));
            } catch (e) {
                console.log(e);
            }
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteAsPlainText",
        label: siyuanI18n.pasteAsPlainText,
        accelerator: "⇧⌘V",
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteAsPlainText(protyle);
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteEscaped",
        label: siyuanI18n.pasteEscaped,
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteEscaped(protyle, nodeElement);
        }
    }).element);
};

/** 添加全选菜单项 */
const 添加全选菜单 = (protyle: IProtyle, nodeElement: Element, range: Range): void => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "selectAll",
        label: siyuanI18n.selectAll,
        icon: "iconSelect",
        accelerator: "⌘A",
        click() {
            selectAll(protyle, nodeElement, range);
        }
    }).element);
};

/** 触发插件的菜单打开事件 */
const 触发插件菜单事件 = (protyle: IProtyle, nodeElement: Element, range: Range): void => {
    if (!protyle?.app?.plugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-content",
        detail: {
            protyle,
            range,
            element: nodeElement,
        },
        separatorPosition: "top",
    });
};

/** 检查是否有选区或选中了表情 */
const 检查有选区或表情 = (range: Range): boolean => {
    if (range.toString() !== "") {
        return true;
    }
    const firstChild = range.cloneContents().childNodes[0];
    if (!isHTMLElement(firstChild)) {
        return false;
    }
    return firstChild.classList?.contains("emoji") ?? false;
};

/**
 * 构建 Protyle 内容区域的右键菜单
 * 
 * 作用：根据当前选区状态和元素类型，构建相应的上下文菜单
 * 
 * 调用时机：用户在编辑器内容区域右键点击时
 */
export const contentMenu = (protyle: IProtyle, nodeElement: Element): void => {
    const range = getEditorRange(nodeElement);
    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_INLINE_CONTEXT);
    // 移动端：使用工具栏显示内容菜单
    if (isMobile) {
        getProtyleToolbar(protyle).showContent(protyle, range, nodeElement);
        触发插件菜单事件(protyle, nodeElement, range);
        return;
    }
    // 桌面端：构建完整的上下文菜单
    const oldHTML = nodeElement.outerHTML;
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("块元素缺少id");
    }
    const ctx: IContentMenuContext = { protyle, nodeElement, range, oldHTML, id };
    const 有选区或表情 = 检查有选区或表情(range);
    if (有选区或表情) {
        const shouldReturn = 添加选区相关菜单(ctx);
        if (shouldReturn) {
            return;
        }
    }
    if (!有选区或表情) {
        添加行内元素菜单(ctx);
    }
    添加粘贴菜单(protyle, nodeElement);
    添加全选菜单(protyle, nodeElement, range);
    const 是可编辑表格 = nodeElement.classList.contains("table") && !protyle.disabled;
    if (是可编辑表格) {
        添加表格菜单({ protyle, range, element: nodeElement });
    }
    触发插件菜单事件(protyle, nodeElement, range);
};


/**
 * 添加表格相关菜单项
 * 
 * 作用：当右键点击表格单元格时，添加表格操作相关的菜单项
 */
const 添加表格菜单 = (detail: {
    protyle: IProtyle,
    range: Range,
    element: Element
}): void => {
    const { protyle, range, element: nodeElement } = detail;
    const tdElement = hasClosestByTag(range.startContainer, "TD");
    const thElement = hasClosestByTag(range.startContainer, "TH");
    const cellElement = tdElement || thElement;
    if (!isHTMLTableCellElement(cellElement)) {
        return;
    }
    const tableMenus = tableMenu(protyle, nodeElement, cellElement, range);
    if (tableMenus.insertMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_1",
            type: "separator",
        }).element);
        tableMenus.insertMenus.forEach((menuItem) => {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        });
    }
    if (tableMenus.removeMenus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_2",
            type: "separator",
        }).element);
        tableMenus.removeMenus.forEach((menuItem) => {
            getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
        });
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "separator_3",
        type: "separator",
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "more",
        type: "submenu",
        icon: "iconMore",
        label: siyuanI18n.more,
        submenu: tableMenus.otherMenus.concat(tableMenus.other2Menus)
    }).element);
};