/**
 * 链接菜单项模块
 *
 * 包含各种链接菜单项的创建函数。
 */
import * as dayjs from "dayjs";
import { focusByRange } from "../../ai/imports";
import { renameAsset } from "../../editor/rename";
import { removeInlineType } from "../../protyle/toolbar/util";
import { writeText } from "../../protyle/util/compatibility";
import { focusByWbr } from "../../protyle/util/selection";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { openMenu } from "../commonMenuItem.openMenu";
import { MenuItem } from "../Menu.Item";
import { exportAsset } from "../util";
import type { LinkMenuContext } from "./protyle.linkMenu.types";

// ────────────────────────────────────────────────────────────
// 菜单项创建函数
// ────────────────────────────────────────────────────────────

/** 添加复制菜单项 */
export const 添加复制菜单项 = (linkElement: HTMLElement): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        /** @简洁函数 菜单的click回调 */
        click() {
            const range = document.createRange();
            range.selectNode(linkElement);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
};

/** 添加复制链接地址菜单项（只读模式） */
export const 添加复制链接地址菜单项 = (linkAddress: string | null): void => {
    if (!linkAddress) {
        return;
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copyAHref",
        label: siyuanI18n.copyAHref,
        icon: "iconLink",
        /** @简洁函数 菜单的click回调 */
        click() {
            writeText(linkAddress);
        }
    }).element);
};

/** 添加剪切菜单项 */
export const 添加剪切菜单项 = (linkElement: HTMLElement): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        label: siyuanI18n.cut,
        /** @简洁函数 菜单的click回调 */
        click() {
            const range = document.createRange();
            range.selectNode(linkElement);
            focusByRange(range);
            document.execCommand("cut");
        }
    }).element);
};

/** 添加删除菜单项 */
export const 添加删除菜单项 = (ctx: LinkMenuContext): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        /** @简洁函数 菜单的click回调 */
        click() {
            ctx.linkElement.insertAdjacentHTML("afterend", "<wbr>");
            ctx.linkElement.remove();
            ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(ctx.protyle, ctx.id, ctx.nodeElement.outerHTML, ctx.html);
            focusByWbr(ctx.nodeElement, ctx.protyle.toolbar.range);
            ctx.html = ctx.nodeElement.outerHTML;
        }
    }).element);
};

/** 添加重命名菜单项（仅资源文件） */
export const 添加重命名菜单项 = (linkAddress: string | null): void => {
    if (!linkAddress?.startsWith("assets/")) {
        return;
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        /** @简洁函数 菜单的click回调 */
        click() {
            renameAsset(linkAddress);
        }
    }).element);
};

/**
 * 处理转换为引用的逻辑
 * @param ctx - 链接菜单上下文
 * @param inputElements - 输入元素列表
 */
const 执行转换为引用 = (ctx: LinkMenuContext, inputElements: NodeListOf<HTMLTextAreaElement>): void => {
    const 链接地址输入框 = inputElements[0];
    const 标题输入框 = inputElements[2];
    if (!链接地址输入框 || !标题输入框) {
        return;
    }

    ctx.linkElement.setAttribute("data-subtype", "s");
    const types = ctx.linkElement.getAttribute("data-type")?.split(" ") ?? [];
    types.push("block-ref");
    const aIndex = types.indexOf("a");
    if (aIndex > -1) {
        types.splice(aIndex, 1);
    }
    ctx.linkElement.setAttribute("data-type", types.join(" "));
    ctx.linkElement.setAttribute("data-id", 链接地址输入框.value.replace("siyuan://blocks/", ""));
    链接地址输入框.value = "";
    标题输入框.value = "";
    ctx.linkElement.removeAttribute("data-href");
    ctx.linkElement.removeAttribute("data-title");
    ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(ctx.protyle, ctx.id, ctx.nodeElement.outerHTML, ctx.html);
    ctx.protyle.toolbar.range.selectNodeContents(ctx.linkElement);
    ctx.protyle.toolbar.range.collapse(false);
    focusByRange(ctx.protyle.toolbar.range);
    ctx.html = ctx.nodeElement.outerHTML;
};

/** 添加转换为引用菜单项（仅思源链接） */
export const 添加转换为引用菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.linkAddress?.startsWith("siyuan://blocks/")) {
        return;
    }
    if (!ctx.inputElements) {
        return;
    }

    const inputElements = ctx.inputElements;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoRef",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.ref}</b>`,
        icon: "iconRef",
        /** @简洁函数 菜单的click回调 */
        click() {
            执行转换为引用(ctx, inputElements);
        }
    }).element);
};

/**
 * 处理转换为文本的逻辑
 * @param ctx - 链接菜单上下文
 * @param inputElements - 输入元素列表
 */
const 执行转换为文本 = (ctx: LinkMenuContext, inputElements: NodeListOf<HTMLTextAreaElement>): void => {
    const 链接地址输入框 = inputElements[0];
    const 标题输入框 = inputElements[2];
    if (!链接地址输入框 || !标题输入框) {
        return;
    }

    链接地址输入框.value = "";
    标题输入框.value = "";
    ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    removeInlineType(ctx.linkElement, "a", ctx.protyle.toolbar.range);
    updateTransaction(ctx.protyle, ctx.id, ctx.nodeElement.outerHTML, ctx.html);
    ctx.html = ctx.nodeElement.outerHTML;
};

/** 添加转换为文本菜单项 */
export const 添加转换为文本菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }

    const inputElements = ctx.inputElements;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoText",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.text}</b>`,
        icon: "iconRefresh",
        /** @简洁函数 菜单的click回调 */
        click() {
            执行转换为文本(ctx, inputElements);
        }
    }).element);
};

/** 添加链接相关菜单项（打开、导出等） */
export const 添加链接操作菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.linkAddress) {
        return;
    }

    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    openMenu(ctx.protyle.app, ctx.linkAddress, false, true);

    if (ctx.linkAddress.startsWith("assets/")) {
        getSiyuanGlobalMenusMenu().append(new MenuItem(exportAsset(ctx.linkAddress)).element);
    }
};

/** 添加编辑操作菜单项（剪切、删除、重命名、转换等） */
export const 添加编辑操作菜单项 = (ctx: LinkMenuContext): void => {
    添加剪切菜单项(ctx.linkElement);
    添加删除菜单项(ctx);
    添加重命名菜单项(ctx.linkAddress);
    添加转换为引用菜单项(ctx);
    添加转换为文本菜单项(ctx);
};
