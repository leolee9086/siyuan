/**
 * Gutter 块菜单 - 复制子菜单构建模块
 * 从 renderMenu 提取的复制菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中复制相关子菜单的构建功能
 * @module protyle/gutter/buildGutterCopyMenu
 */

import {copySubMenu} from "../../menus/commonMenuItem/copy/copySubMenu.factory";
import { copyPlainText, writeText } from "../util/compatibility";
import { focusBlock, focusByRange, getEditorRange } from "../util/selection";
import { getPlainText } from "../util/paste";
import { isNotEditBlock } from "../wysiwyg/getBlock";
import { duplicateBlock } from "../wysiwyg/commonHotkey/commonHotkey";
import { duplicateCompletely } from "../render/av/action/duplicate";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 生成复制文本引用菜单项
 * @param nodeElements 选中元素列表
 * @returns 菜单项或false
 */
export const genCopyTextRef = (nodeElements: Element[]): false | IMenu => {
    const element = nodeElements[0];
    if (!element || isNotEditBlock(element)) {
        return false;
    }
    return {
        id: "copyText",
        iconHTML: "",
        accelerator: getSiyuanConfig().keymap.editor.general.copyText.custom,
        label: siyuanI18n.copyText,
        click() {
            // 用于标识复制文本 *
            element.setAttribute("data-reftext", "true");
            focusByRange(getEditorRange(element));
            document.execCommand("copy");
        }
    };
};

/**
 * Gutter 复制菜单构建上下文
 * @interface IGutterCopyMenuContext
 */
export interface IGutterCopyMenuContext {
    /** 目标节点元素 */
    nodeElement: Element;
    /** 节点类型，如 "NodeParagraph", "NodeAttributeView" 等 */
    type: string;
    /** 节点 ID */
    id: string;
    /** Protyle 实例 */
    protyle: IProtyle;
    allowDuplicate?: boolean;
}

/**
 * 创建复制纯文本菜单项
 * @param ctx 上下文
 * @returns 复制纯文本菜单项
 */
const createCopyPlainTextItem = (ctx: IGutterCopyMenuContext): IMenu => ({
    id: "copyPlainText",
    iconHTML: "",
    label: siyuanI18n.copyPlainText,
    accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
    click() {
        copyPlainText(getPlainText(ctx.nodeElement as HTMLElement).trimEnd());
        focusBlock(ctx.nodeElement);
    }
});

/**
 * 创建复制内容菜单项（根据块类型选择不同的标签和 ID）
 * @param ctx 上下文
 * @returns 复制内容菜单项
 */
const createCopyContentItem = (ctx: IGutterCopyMenuContext): IMenu => {
    const 是属性视图 = ctx.type === "NodeAttributeView";
    return {
        id: 是属性视图 ? "copyMirror" : "copy",
        iconHTML: "",
        label: 是属性视图 ? siyuanI18n.copyMirror : siyuanI18n.copy,
        accelerator: "⌘C",
        click() {
            // 非编辑块需要聚焦块本身
            if (isNotEditBlock(ctx.nodeElement)) {
                focusBlock(ctx.nodeElement);
                document.execCommand("copy");
                return;
            }
            // 可编辑块需要聚焦到编辑范围
            focusByRange(getEditorRange(ctx.nodeElement));
            document.execCommand("copy");
        }
    };
};

/**
 * 创建复制属性视图 ID 菜单项
 * @param ctx 上下文
 * @returns 复制属性视图 ID 菜单项
 */
const createCopyAVIDItem = (ctx: IGutterCopyMenuContext): IMenu => ({
    iconHTML: "",
    label: siyuanI18n.copyAVID,
    click() {
        writeText(ctx.nodeElement.getAttribute("data-av-id") || "");
    }
});

/**
 * 创建复制镜像副本菜单项
 * @param ctx 上下文
 * @returns 复制镜像副本菜单项
 */
const createDuplicateMirrorItem = (ctx: IGutterCopyMenuContext): IMenu => ({
    id: "duplicateMirror",
    iconHTML: "",
    label: siyuanI18n.duplicateMirror,
    accelerator: getSiyuanConfig().keymap.editor.general.duplicate.custom,
    click() {
        duplicateBlock([ctx.nodeElement], ctx.protyle);
    }
});

/**
 * 创建复制完整副本菜单项
 * @param ctx 上下文
 * @returns 复制完整副本菜单项
 */
const createDuplicateCompletelyItem = (ctx: IGutterCopyMenuContext): IMenu => ({
    id: "duplicateCompletely",
    iconHTML: "",
    label: siyuanI18n.duplicateCompletely,
    accelerator: getSiyuanConfig().keymap.editor.general.duplicateCompletely.custom,
    click() {
        duplicateCompletely(ctx.protyle, ctx.nodeElement as HTMLElement);
    }
});

/**
 * 创建复制副本菜单项（普通块）
 * @param ctx 上下文
 * @returns 复制副本菜单项
 */
const createDuplicateItem = (ctx: IGutterCopyMenuContext): IMenu => ({
    id: "duplicate",
    iconHTML: "",
    label: siyuanI18n.duplicate,
    accelerator: getSiyuanConfig().keymap.editor.general.duplicate.custom,
    click() {
        duplicateBlock([ctx.nodeElement], ctx.protyle);
    }
});

/**
 * 为属性视图块添加特有的菜单项
 * @param copyMenu 复制菜单数组
 * @param ctx 上下文
 */
const appendAttributeViewItems = (copyMenu: IMenu[], ctx: IGutterCopyMenuContext): void => {
    // 添加复制属性视图 ID
    copyMenu.splice(6, 0, createCopyAVIDItem(ctx));

    // 禁用状态下不添加复制副本菜单项
    if (ctx.protyle.disabled || ctx.allowDuplicate === false) {
        return;
    }

    copyMenu.push(createDuplicateMirrorItem(ctx));
    copyMenu.push(createDuplicateCompletelyItem(ctx));
};

/**
 * 为普通块添加复制副本菜单项
 * @param copyMenu 复制菜单数组
 * @param ctx 上下文
 */
const appendNormalBlockItems = (copyMenu: IMenu[], ctx: IGutterCopyMenuContext): void => {
    // 禁用状态下不添加
    if (ctx.protyle.disabled || ctx.allowDuplicate === false) {
        return;
    }

    copyMenu.push(createDuplicateItem(ctx));
};

/**
 * 构建 Gutter 复制子菜单项
 * 
 * @param ctx 复制菜单构建上下文
 * @returns 复制菜单项
 */
export const buildGutterCopyMenuItem = (ctx: IGutterCopyMenuContext): IMenu => {
    // 基础复制菜单项
    const copyMenu = copySubMenu([ctx.id], true, ctx.nodeElement).concat([
        createCopyPlainTextItem(ctx),
        createCopyContentItem(ctx)
    ]);

    // 添加复制文本引用菜单项
    const copyTextRefMenu = genCopyTextRef([ctx.nodeElement]);
    if (copyTextRefMenu) {
        copyMenu.splice(7, 0, copyTextRefMenu);
    }

    // 属性视图特殊处理
    // 属性视图特殊处理
    if (ctx.type === "NodeAttributeView") {
        appendAttributeViewItems(copyMenu, ctx);
    }

    if (ctx.type !== "NodeAttributeView") {
        // 普通块处理
        appendNormalBlockItems(copyMenu, ctx);
    }

    return {
        id: "copy",
        icon: "iconCopy",
        label: siyuanI18n.copy,
        type: "submenu",
        submenu: copyMenu
    };
};
