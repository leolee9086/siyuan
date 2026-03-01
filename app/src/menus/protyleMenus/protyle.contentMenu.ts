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
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSelection } from "../../util/DOM/range.global";
import type { IContentMenuContext, IInlineMenuContext } from "./protyle.types";
import { isHTMLElement } from "../../util/DOM/element.guard";
import { 添加表格菜单 } from "./protyle.tableMenu";


/**
 * 添加有选区时的菜单项（复制、复制纯文本、剪切、删除）
 * @returns 如果 protyle.disabled 为 true 则返回 true，表示应该提前退出
 */
const 添加选区相关菜单 = (ctx: IContentMenuContext): boolean => {
    const { protyle, nodeElement, oldHTML, id, captionElement } = ctx;
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        icon: "iconCopy",
        accelerator: "⌘C",
        label: siyuanI18n.copy,
        /** 复制选中内容到剪贴板 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("copy");
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
        /** 复制选中内容为纯文本（去除格式） */
        click() {
            focusByRange(getEditorRange(nodeElement));
            copyPlainText(getSelection().getRangeAt(0).toString());
        }
    }).element);
    if (protyle.disabled || captionElement) {
        return true;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        accelerator: "⌘X",
        label: siyuanI18n.cut,
        /** 剪切选中内容 */
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
        /** 删除选中内容并更新事务 */
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
        /** 将行内元素内容转换为 Markdown 并复制 */
        click() {
            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copyPlainText",
        label: siyuanI18n.copyPlainText,
        /** 复制行内元素纯文本内容 */
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
        /** 将行内元素转为 Markdown 后剪切，并更新事务 */
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
        /** 删除行内元素并更新事务 */
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
const 添加粘贴菜单 = (protyle: IProtyle, nodeElement: Element, captionElement: false | HTMLElement): void => {
    // 表格caption内或只读模式下不显示粘贴菜单，防止破坏表格标题结构
    if (protyle.disabled || captionElement) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "paste",
        label: siyuanI18n.paste,
        icon: "iconPaste",
        accelerator: "⌘V",
        /** 粘贴剪贴板内容，优先使用浏览器原生 execCommand，降级为手动读取剪贴板 */
        async click() {
            focusByRange(getEditorRange(nodeElement));
            // 部分浏览器/环境支持原生 paste 命令，此时直接调用，避免权限申请
            if (document.queryCommandSupported("paste")) {
                document.execCommand("paste");
                return;
            }
            try {
                const text = await readClipboard();
                if (!isHTMLElement(nodeElement)) {
                    return;
                }
                paste(protyle, Object.assign(text, { target: nodeElement }));
            } catch (e) {
                console.log(e);
            }
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteAsPlainText",
        label: siyuanI18n.pasteAsPlainText,
        accelerator: "⇧⌘V",
        /** 以纯文本形式粘贴，去除富文本格式 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteAsPlainText(protyle);
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "pasteEscaped",
        label: siyuanI18n.pasteEscaped,
        /** 粘贴并自动转义 Markdown 特殊字符，避免影响文档结构 */
        click() {
            focusByRange(getEditorRange(nodeElement));
            pasteEscaped(protyle, nodeElement);
        }
    }).element);
};

/** 添加全选菜单项 */
const 添加全选菜单 = (protyle: IProtyle, nodeElement: Element, range: Range, captionElement: false | HTMLElement): void => {
    // 表格caption内不显示全选菜单，避免在表格标题中触发全选操作
    if (captionElement) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "selectAll",
        label: siyuanI18n.selectAll,
        icon: "iconSelect",
        accelerator: "⌘A",
        /** 全选当前块的内容 */
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
 * 意图：集中管理编辑器内容区右键菜单的构建入口，使各子菜单逻辑保持内聚
 * 调用时机：用户在编辑器内容区域右键点击时
 */
/** @同步豁免: UI构建 — 右键菜单需要在同步调用栈中同步组装所有菜单项，否则菜单将出现闪烁或排序错乱 */
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
    // 检测光标是否在表格caption元素内，用于阻止剪切/删除/粘贴/全选操作
    const captionElement = hasClosestByTag(range.startContainer, "CAPTION");
    const ctx: IContentMenuContext = { protyle, nodeElement, range, oldHTML, id, captionElement };
    const 有选区或表情 = 检查有选区或表情(range);
    // 有选区时展示复制/剪切/删除菜单；选区包含表情时也走此分支，若禁用状态则提前退出
    if (有选区或表情 && 添加选区相关菜单(ctx)) {
        return;
    }
    // 无选区时检测行内元素（code/kbd），显示行内专属菜单
    if (!有选区或表情) {
        添加行内元素菜单(ctx);
    }
    添加粘贴菜单(protyle, nodeElement, captionElement);
    添加全选菜单(protyle, nodeElement, range, captionElement);
    // 仅对可编辑的表格块追加表格操作菜单
    const 是可编辑表格 = nodeElement.classList.contains("table") && !protyle.disabled;
    if (是可编辑表格) {
        添加表格菜单({ protyle, range, element: nodeElement });
    }
    触发插件菜单事件(protyle, nodeElement, range);
};