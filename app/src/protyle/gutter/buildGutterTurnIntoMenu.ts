/**
 * Gutter 块菜单 - 转换子菜单构建模块
 * 从 renderMenu 提取的转换菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中“转换” (Turn Into) 相关子菜单的构建功能
 * @module protyle/gutter/buildGutterTurnIntoMenu
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 转换菜单构建上下文
 * @interface IGutterTurnIntoContext
 */
export interface IGutterTurnIntoContext {
    /** 目标节点元素 */
    nodeElement: Element;
    /** 节点 ID */
    id: string;
    /** 节点类型 (NodeParagraph, NodeHeading, etc.) */
    type: string;
    /** 节点子类型 (h1-h6, etc.) */
    subType: string;
    /** Protyle 实例 */
    protyle: IProtyle;
    /** 转换一个块的方法 (由 Gutter 实例提供) */
    turnsOneInto: (options: {
        menuId?: string,
        id: string,
        icon: string,
        label: string,
        protyle: IProtyle,
        nodeElement: Element,
        type: string,
        level?: number
    }) => IMenu;
    /** 将块转换为另一个块的方法 (由 Gutter 实例提供) */
    turnsIntoOne: (options: {
        menuId?: string,
        accelerator?: string,
        icon?: string,
        label: string,
        protyle: IProtyle,
        selectsElement: Element[],
        type: TTurnIntoOne,
        level?: TTurnIntoOneSub,
    }) => IMenu;
    /** 转换块的方法 (由 Gutter 实例提供) */
    turnsInto: (options: {
        menuId?: string,
        icon?: string,
        label: string,
        protyle: IProtyle,
        selectsElement: Element[],
        type: TTurnInto,
        level?: number,
        isContinue?: boolean,
        accelerator?: string,
    }) => IMenu;
}

/**
 * 构建 Gutter 转换子菜单
 * 
 * @param ctx 转换菜单构建上下文
 * @returns 转换子菜单项数组
 */
export const buildGutterTurnIntoMenu = (ctx: IGutterTurnIntoContext): IMenu[] => {
    const { type, subType, nodeElement, id, protyle } = ctx;
    const turnIntoSubmenu: IMenu[] = [];

    if (type === "NodeParagraph" && !protyle.disabled) {
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "list",
            icon: "iconList",
            label: siyuanI18n.list,
            accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2ULs"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "orderedList",
            icon: "iconOrderedList",
            label: siyuanI18n["ordered-list"],
            accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2OLs"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "check",
            icon: "iconCheck",
            label: siyuanI18n.check,
            accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2TLs"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "quote",
            icon: "iconQuote",
            label: siyuanI18n.quote,
            accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Blockquote"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "callout",
            icon: "iconCallout",
            label: siyuanI18n.callout,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Callout"
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading1",
            icon: "iconH1",
            label: siyuanI18n.heading1,
            accelerator: window.siyuan.config.keymap.editor.heading.heading1.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 1,
            type: "Blocks2Hs",
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading2",
            icon: "iconH2",
            label: siyuanI18n.heading2,
            accelerator: window.siyuan.config.keymap.editor.heading.heading2.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 2,
            type: "Blocks2Hs",
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading3",
            icon: "iconH3",
            label: siyuanI18n.heading3,
            accelerator: window.siyuan.config.keymap.editor.heading.heading3.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 3,
            type: "Blocks2Hs",
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading4",
            icon: "iconH4",
            label: siyuanI18n.heading4,
            accelerator: window.siyuan.config.keymap.editor.heading.heading4.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 4,
            type: "Blocks2Hs",
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading5",
            icon: "iconH5",
            label: siyuanI18n.heading5,
            accelerator: window.siyuan.config.keymap.editor.heading.heading5.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 5,
            type: "Blocks2Hs",
        }));
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "heading6",
            icon: "iconH6",
            label: siyuanI18n.heading6,
            accelerator: window.siyuan.config.keymap.editor.heading.heading6.custom,
            protyle,
            selectsElement: [nodeElement],
            level: 6,
            type: "Blocks2Hs",
        }));
    } else if (type === "NodeHeading" && !protyle.disabled) {
        turnIntoSubmenu.push(ctx.turnsInto({
            menuId: "paragraph",
            icon: "iconParagraph",
            label: siyuanI18n.paragraph,
            accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Ps",
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "quote",
            icon: "iconQuote",
            label: siyuanI18n.quote,
            accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Blockquote"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "callout",
            icon: "iconCallout",
            label: siyuanI18n.callout,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Callout"
        }));
        if (subType !== "h1") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading1",
                icon: "iconH1",
                label: siyuanI18n.heading1,
                accelerator: window.siyuan.config.keymap.editor.heading.heading1.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 1,
                type: "Blocks2Hs",
            }));
        }
        if (subType !== "h2") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading2",
                icon: "iconH2",
                label: siyuanI18n.heading2,
                accelerator: window.siyuan.config.keymap.editor.heading.heading2.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 2,
                type: "Blocks2Hs",
            }));
        }
        if (subType !== "h3") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading3",
                icon: "iconH3",
                label: siyuanI18n.heading3,
                accelerator: window.siyuan.config.keymap.editor.heading.heading3.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 3,
                type: "Blocks2Hs",
            }));
        }
        if (subType !== "h4") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading4",
                icon: "iconH4",
                label: siyuanI18n.heading4,
                accelerator: window.siyuan.config.keymap.editor.heading.heading4.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 4,
                type: "Blocks2Hs",
            }));
        }
        if (subType !== "h5") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading5",
                icon: "iconH5",
                label: siyuanI18n.heading5,
                accelerator: window.siyuan.config.keymap.editor.heading.heading5.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 5,
                type: "Blocks2Hs",
            }));
        }
        if (subType !== "h6") {
            turnIntoSubmenu.push(ctx.turnsInto({
                menuId: "heading6",
                icon: "iconH6",
                label: siyuanI18n.heading6,
                accelerator: window.siyuan.config.keymap.editor.heading.heading6.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 6,
                type: "Blocks2Hs",
            }));
        }
    } else if (type === "NodeList" && !protyle.disabled) {
        turnIntoSubmenu.push(ctx.turnsOneInto({
            menuId: "paragraph",
            id,
            icon: "iconParagraph",
            label: siyuanI18n.paragraph,
            accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
            protyle,
            nodeElement,
            type: "CancelList"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "quote",
            icon: "iconQuote",
            label: siyuanI18n.quote,
            accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Blockquote"
        }));
        turnIntoSubmenu.push(ctx.turnsIntoOne({
            menuId: "callout",
            icon: "iconCallout",
            label: siyuanI18n.callout,
            protyle,
            selectsElement: [nodeElement],
            type: "Blocks2Callout"
        }));
        if (nodeElement.getAttribute("data-subtype") === "o") {
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "list",
                id,
                icon: "iconList",
                label: siyuanI18n.list,
                accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
                protyle,
                nodeElement,
                type: "OL2UL"
            }));
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "check",
                id,
                icon: "iconCheck",
                label: siyuanI18n.check,
                accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
                protyle,
                nodeElement,
                type: "UL2TL"
            }));
        } else if (nodeElement.getAttribute("data-subtype") === "t") {
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "list",
                id,
                icon: "iconList",
                label: siyuanI18n.list,
                accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
                protyle,
                nodeElement,
                type: "TL2UL"
            }));
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "orderedList",
                id,
                icon: "iconOrderedList",
                label: siyuanI18n["ordered-list"],
                accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
                protyle,
                nodeElement,
                type: "TL2OL"
            }));
        } else {
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "orderedList",
                id,
                icon: "iconOrderedList",
                label: siyuanI18n["ordered-list"],
                accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
                protyle,
                nodeElement,
                type: "UL2OL"
            }));
            turnIntoSubmenu.push(ctx.turnsOneInto({
                menuId: "check",
                id,
                icon: "iconCheck",
                label: siyuanI18n.check,
                accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
                protyle,
                nodeElement,
                type: "OL2TL"
            }));
        }
    } else if (type === "NodeBlockquote" && !protyle.disabled) {
        turnIntoSubmenu.push(ctx.turnsOneInto({
            menuId: "paragraph",
            id,
            icon: "iconParagraph",
            label: siyuanI18n.paragraph,
            accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
            protyle,
            nodeElement,
            type: "CancelBlockquote"
        }));
        turnIntoSubmenu.push(ctx.turnsOneInto({
            id,
            icon: "iconCallout",
            label: siyuanI18n.callout,
            protyle,
            nodeElement,
            type: "Blockquote2Callout"
        }));
    } else if (type === "NodeCallout" && !protyle.disabled) {
        turnIntoSubmenu.push(ctx.turnsOneInto({
            menuId: "paragraph",
            id,
            icon: "iconParagraph",
            label: siyuanI18n.paragraph,
            accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
            protyle,
            nodeElement,
            type: "CancelCallout"
        }));
        turnIntoSubmenu.push(ctx.turnsOneInto({
            id,
            icon: "iconQuote",
            label: siyuanI18n.quote,
            protyle,
            nodeElement,
            type: "Callout2Blockquote"
        }));
    }

    return turnIntoSubmenu;
};
