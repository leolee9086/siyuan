/**
 * Gutter 块菜单 - 转换子菜单构建模块
 * 从 renderMenu 提取的转换菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中“转换” (Turn Into) 相关子菜单的构建功能
 * @module protyle/gutter/buildGutterTurnIntoMenu
 */

import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { buildListMenu } from "./buildGutterListMenu";
import { turnsIntoOneTransaction, turnsIntoTransaction, turnsOneInto } from "../wysiwyg/transaction";

/**
 * 生成单个块转换菜单项
 */
export const genTurnsOneInto = (options: {
    menuId?: string,
    id: string,
    icon: string,
    label: string,
    protyle: IProtyle,
    nodeElement: Element,
    type: string,
    level?: number,
    accelerator?: string
}): IMenu => {
    return {
        id: options.menuId,
        icon: options.icon,
        label: options.label,
        accelerator: options.accelerator,
        click() {
            turnsOneInto(options);
        }
    } as IMenu;
};

/**
 * 生成转换为单一块菜单项
 */
export const genTurnsIntoOne = (options: {
    menuId?: string,
    accelerator?: string,
    icon?: string,
    label: string,
    protyle: IProtyle,
    selectsElement: Element[],
    type: TTurnIntoOne,
    level?: TTurnIntoOneSub,
}): IMenu => {
    return {
        id: options.menuId,
        icon: options.icon,
        label: options.label,
        accelerator: options.accelerator,
        click() {
            turnsIntoOneTransaction(options);
        }
    } as IMenu;
};

/**
 * 生成转换菜单项
 */
export const genTurnsInto = (options: {
    menuId?: string,
    icon?: string,
    label: string,
    protyle: IProtyle,
    selectsElement: Element[],
    type: TTurnInto,
    level?: number,
    isContinue?: boolean,
    accelerator?: string,
}): IMenu => {
    return {
        id: options.menuId,
        icon: options.icon,
        label: options.label,
        accelerator: options.accelerator,
        click() {
            turnsIntoTransaction(options);
        }
    } as IMenu;
};

// Local definition for missing global types
type TTurnIntoOne = "BlocksMergeSuperBlock" | "Blocks2ULs" | "Blocks2OLs" | "Blocks2TLs" | "Blocks2Blockquote" | "Blocks2Callout";
type TTurnIntoOneSub = "row" | "col";
type TTurnInto = "Blocks2Ps" | "Blocks2Hs";

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
}

/**
 * 添加 "转换为单一块" (turnsIntoOne) 菜单项的辅助函数
 */
const addTurnIntoOne = (
    ctx: IGutterTurnIntoContext,
    target: IMenu[],
    options: {
        menuId: string;
        icon: string;
        label: string;
        accelerator?: string;
        type: TTurnIntoOne;
        level?: TTurnIntoOneSub;
    }
) => {
    target.push(genTurnsIntoOne({
        menuId: options.menuId,
        icon: options.icon,
        label: options.label,
        accelerator: options.accelerator,
        protyle: ctx.protyle,
        selectsElement: [ctx.nodeElement],
        type: options.type,
        level: options.level
    }));
};

/**
 * 添加 "转换为多个块" (turnsInto) 菜单项的辅助函数
 */
const addTurnInto = (
    ctx: IGutterTurnIntoContext,
    target: IMenu[],
    options: {
        menuId: string;
        icon: string;
        label: string;
        accelerator?: string;
        type: TTurnInto;
        level?: number;
    }
) => {
    target.push(genTurnsInto({
        menuId: options.menuId,
        icon: options.icon,
        label: options.label,
        accelerator: options.accelerator,
        protyle: ctx.protyle,
        selectsElement: [ctx.nodeElement],
        type: options.type,
        level: options.level
    }));
};



/**
 * 获取插入操作的快捷键配置
 */
const getInsertKeymap = () => {
    return getSiyuanConfig().keymap.editor.insert;
};

/**
 * 获取标题操作的快捷键配置
 */
const getHeadingKeymap = () => {
    return getSiyuanConfig().keymap.editor.heading;
};

/**
 * 添加段落类型的转换菜单
 */
const buildParagraphMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const headingKeys = getHeadingKeymap();

    // 解决隐式上下文切换
    const orderedListConfig = insertKeys["ordered-list"];

    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "list",
        icon: "iconList",
        label: siyuanI18n.list,
        accelerator: insertKeys.list.custom,
        type: "Blocks2ULs"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "orderedList",
        icon: "iconOrderedList",
        label: siyuanI18n["ordered-list"],
        accelerator: orderedListConfig.custom,
        type: "Blocks2OLs"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "check",
        icon: "iconCheck",
        label: siyuanI18n.check,
        accelerator: insertKeys.check.custom,
        type: "Blocks2TLs"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "quote",
        icon: "iconQuote",
        label: siyuanI18n.quote,
        accelerator: insertKeys.quote.custom,
        type: "Blocks2Blockquote"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "callout",
        icon: "iconCallout",
        label: siyuanI18n.callout,
        type: "Blocks2Callout"
    });

    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading1", icon: "iconH1", label: siyuanI18n.heading1, accelerator: headingKeys.heading1.custom, type: "Blocks2Hs", level: 1 });
    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading2", icon: "iconH2", label: siyuanI18n.heading2, accelerator: headingKeys.heading2.custom, type: "Blocks2Hs", level: 2 });
    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading3", icon: "iconH3", label: siyuanI18n.heading3, accelerator: headingKeys.heading3.custom, type: "Blocks2Hs", level: 3 });
    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading4", icon: "iconH4", label: siyuanI18n.heading4, accelerator: headingKeys.heading4.custom, type: "Blocks2Hs", level: 4 });
    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading5", icon: "iconH5", label: siyuanI18n.heading5, accelerator: headingKeys.heading5.custom, type: "Blocks2Hs", level: 5 });
    addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading6", icon: "iconH6", label: siyuanI18n.heading6, accelerator: headingKeys.heading6.custom, type: "Blocks2Hs", level: 6 });
};

/**
 * 添加标题类型的转换菜单
 */
const buildHeadingMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const headingKeys = getHeadingKeymap();

    addTurnInto(ctx, turnIntoSubmenu, {
        menuId: "paragraph",
        icon: "iconParagraph",
        label: siyuanI18n.paragraph,
        accelerator: headingKeys.paragraph.custom,
        type: "Blocks2Ps"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "quote",
        icon: "iconQuote",
        label: siyuanI18n.quote,
        accelerator: insertKeys.quote.custom,
        type: "Blocks2Blockquote"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "callout",
        icon: "iconCallout",
        label: siyuanI18n.callout,
        type: "Blocks2Callout"
    });

    if (ctx.subType !== "h1") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading1", icon: "iconH1", label: siyuanI18n.heading1, accelerator: headingKeys.heading1.custom, type: "Blocks2Hs", level: 1 });
    if (ctx.subType !== "h2") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading2", icon: "iconH2", label: siyuanI18n.heading2, accelerator: headingKeys.heading2.custom, type: "Blocks2Hs", level: 2 });
    if (ctx.subType !== "h3") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading3", icon: "iconH3", label: siyuanI18n.heading3, accelerator: headingKeys.heading3.custom, type: "Blocks2Hs", level: 3 });
    if (ctx.subType !== "h4") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading4", icon: "iconH4", label: siyuanI18n.heading4, accelerator: headingKeys.heading4.custom, type: "Blocks2Hs", level: 4 });
    if (ctx.subType !== "h5") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading5", icon: "iconH5", label: siyuanI18n.heading5, accelerator: headingKeys.heading5.custom, type: "Blocks2Hs", level: 5 });
    if (ctx.subType !== "h6") addTurnInto(ctx, turnIntoSubmenu, { menuId: "heading6", icon: "iconH6", label: siyuanI18n.heading6, accelerator: headingKeys.heading6.custom, type: "Blocks2Hs", level: 6 });
};

/**
 * 添加列表类型的转换菜单
 */


import { buildBlockquoteMenu, buildCalloutMenu } from "./buildGutterQuoteMenu";

/**
 * 构建 Gutter 转换子菜单
 * 
 * @param ctx 转换菜单构建上下文
 * @returns 转换子菜单项数组
 */
export const buildGutterTurnIntoMenu = (ctx: IGutterTurnIntoContext): IMenu[] => {
    const { type, protyle } = ctx;
    const turnIntoSubmenu: IMenu[] = [];

    if (protyle.disabled) {
        return turnIntoSubmenu;
    }

    if (type === "NodeParagraph") {
        buildParagraphMenu(ctx, turnIntoSubmenu);
        return turnIntoSubmenu;
    }

    if (type === "NodeHeading") {
        buildHeadingMenu(ctx, turnIntoSubmenu);
        return turnIntoSubmenu;
    }

    if (type === "NodeList") {
        buildListMenu(ctx, turnIntoSubmenu);
        return turnIntoSubmenu;
    }

    if (type === "NodeBlockquote") {
        buildBlockquoteMenu(ctx, turnIntoSubmenu);
        return turnIntoSubmenu;
    }

    if (type === "NodeCallout") {
        buildCalloutMenu(ctx, turnIntoSubmenu);
        return turnIntoSubmenu;
    }

    return turnIntoSubmenu;
};
