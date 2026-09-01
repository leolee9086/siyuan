/**
 * Gutter 块菜单 - 转换子菜单构建模块
 * 从 renderMenu 提取的转换菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中“转换” (Turn Into) 相关子菜单的构建功能
 * @module protyle/gutter/buildGutterTurnIntoMenu
 */

/** 用途：读取当前语言的菜单标签；使用范围：gutter 转换菜单；解耦评估：由 gutter imports.ts 统一提供，无法由局部参数替代。 */
import {siyuanI18n} from "./imports";
/** 用途：读取快捷键与配置；使用范围：转换菜单 accelerator；解耦评估：经 gutter imports.ts 集中读取，避免菜单分支复制配置入口。 */
import {getSiyuanConfig} from "./imports";
/** 用途：生成列表转换菜单；使用范围：段落/列表 gutter 分支；解耦评估：复用同一菜单构建器避免重复操作定义。 */
import {buildListMenu} from "./buildGutterListMenu";
/** 用途：生成 blockquote 转换菜单；使用范围：对应块类型分支；解耦评估：共享 quote 菜单语义，参数注入不足以替代模块契约。 */
import {buildBlockquoteMenu} from "./buildGutterQuoteMenu";
/** 用途：生成 callout 转换菜单；使用范围：对应块类型分支；解耦评估：共享 quote 菜单语义，参数注入不足以替代模块契约。 */
import {buildCalloutMenu} from "./buildGutterQuoteMenu";
/** 用途：提供 gutter 转换上下文类型；使用范围：本文件所有 builder；解耦评估：纯类型边界，不产生运行时依赖。 */
import type {IGutterTurnIntoContext} from "./gutter.types";
/** 用途：约束标题目标描述的字面量；使用范围：标题菜单生成器；解耦评估：纯类型边界，避免配置字符串扩大为任意值。 */
import type {IGutterHeadingTargetDescriptor} from "./gutter.types";
/** 用途：约束空段落目标描述的字面量；使用范围：空段落菜单生成器；解耦评估：纯类型边界，保证事务目标与菜单一致。 */
import type {IGutterEmptyParagraphTargetDescriptor} from "./gutter.types";
/** 用途：创建多块转换菜单项；使用范围：本文件的块转换目标；解耦评估：集中处理事务参数与菜单元数据。 */
import {genTurnsInto} from "./turnInto/items";
/** 用途：创建单块转换菜单项；使用范围：本文件的块转换目标；解耦评估：集中处理事务参数与菜单元数据。 */
import {genTurnsIntoOne} from "./turnInto/items";
/** 用途：识别空段落；使用范围：空段落快捷菜单；解耦评估：经 gutter imports.ts 统一调用 wysiwyg 事务所有者。 */
import {isEmptyParagraph} from "./imports";
/** 用途：执行空段落事务；使用范围：空段落快捷菜单点击；解耦评估：经 gutter imports.ts 保持 undo/focus 语义集中。 */
import {turnEmptyParagraphsIntoTransaction} from "./imports";

/**
 * 添加 "转换为单一块" (turnsIntoOne) 菜单项的辅助函数
 */
// @柯里化：捕获当前 gutter 上下文，将统一生成器参数绑定到当前块。
const addTurnIntoOne = (
    ctx: IGutterTurnIntoContext,
    target: IMenu[],
    options: {
        menuId: string;
        icon: string;
        label: string;
        accelerator?: string | undefined;
        type: TTurnIntoOne;
        level?: TTurnIntoOneSub | undefined;
    }
) => {
    target.push(genTurnsIntoOne({
        menuId: options.menuId,
        icon: options.icon,
        label: options.label,
        ...(options.accelerator !== undefined ? {accelerator: options.accelerator} : {}),
        protyle: ctx.protyle,
        selectsElement: [ctx.nodeElement],
        type: options.type,
        ...(options.level !== undefined ? {level: options.level} : {}),
    }));
};

/**
 * 添加 "转换为多个块" (turnsInto) 菜单项的辅助函数
 */
// @柯里化：捕获当前 gutter 上下文，将统一生成器参数绑定到当前块。
const addTurnInto = (
    ctx: IGutterTurnIntoContext,
    target: IMenu[],
    options: {
        menuId: string;
        icon: string;
        label: string;
        accelerator?: string | undefined;
        type: TTurnInto;
        level?: number | undefined;
    }
) => {
    target.push(genTurnsInto({
        menuId: options.menuId,
        icon: options.icon,
        label: options.label,
        ...(options.accelerator !== undefined ? {accelerator: options.accelerator} : {}),
        protyle: ctx.protyle,
        selectsElement: [ctx.nodeElement],
        type: options.type,
        ...(options.level !== undefined ? {level: options.level} : {}),
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

/** 逐项返回标题转换目标描述，避免在模块级持有可变数组。 */
function* getHeadingTargetDescriptors() {
    yield {subType: "h1", menuId: "heading1", icon: "iconH1", labelKey: "heading1", level: 1} satisfies IGutterHeadingTargetDescriptor;
    yield {subType: "h2", menuId: "heading2", icon: "iconH2", labelKey: "heading2", level: 2} satisfies IGutterHeadingTargetDescriptor;
    yield {subType: "h3", menuId: "heading3", icon: "iconH3", labelKey: "heading3", level: 3} satisfies IGutterHeadingTargetDescriptor;
    yield {subType: "h4", menuId: "heading4", icon: "iconH4", labelKey: "heading4", level: 4} satisfies IGutterHeadingTargetDescriptor;
    yield {subType: "h5", menuId: "heading5", icon: "iconH5", labelKey: "heading5", level: 5} satisfies IGutterHeadingTargetDescriptor;
    yield {subType: "h6", menuId: "heading6", icon: "iconH6", labelKey: "heading6", level: 6} satisfies IGutterHeadingTargetDescriptor;
}

/** 逐项返回空段落转换目标描述，调用时生成短生命周期的菜单数据。 */
function* getEmptyParagraphTargetDescriptors() {
    yield {id: "code", icon: "iconCode", labelKey: "code", type: "code"} satisfies IGutterEmptyParagraphTargetDescriptor;
    yield {id: "table", icon: "iconTable", labelKey: "table", type: "table"} satisfies IGutterEmptyParagraphTargetDescriptor;
    yield {id: "line", icon: "iconLine", labelKey: "line", type: "line"} satisfies IGutterEmptyParagraphTargetDescriptor;
    yield {id: "math", icon: "iconMath", labelKey: "math", type: "math"} satisfies IGutterEmptyParagraphTargetDescriptor;
}

/**
 * 添加段落类型的转换菜单
 */
const buildParagraphMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const headingKeys = getHeadingKeymap();

    if (insertKeys) {
        const orderedListConfig = insertKeys["ordered-list"];
        addTurnIntoOne(ctx, turnIntoSubmenu, {
            menuId: "list",
            icon: "iconList",
            label: siyuanI18n.list,
            accelerator: insertKeys.list?.custom,
            type: "Blocks2ULs"
        });
        addTurnIntoOne(ctx, turnIntoSubmenu, {
            menuId: "orderedList",
            icon: "iconOrderedList",
            label: siyuanI18n["ordered-list"],
            accelerator: orderedListConfig?.custom,
            type: "Blocks2OLs"
        });
        addTurnIntoOne(ctx, turnIntoSubmenu, {
            menuId: "check",
            icon: "iconCheck",
            label: siyuanI18n.check,
            accelerator: insertKeys.check?.custom,
            type: "Blocks2TLs"
        });
        addTurnIntoOne(ctx, turnIntoSubmenu, {
            menuId: "quote",
            icon: "iconQuote",
            label: siyuanI18n.quote,
            accelerator: insertKeys.quote?.custom,
            type: "Blocks2Blockquote"
        });
    }

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
        accelerator: insertKeys?.quote?.custom,
        type: "Blocks2Blockquote"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "callout",
        icon: "iconCallout",
        label: siyuanI18n.callout,
        type: "Blocks2Callout"
    });

    // 标题转换菜单按固定层级顺序生成，并排除当前层级以避免提供无效的自转换操作。
    for (const item of getHeadingTargetDescriptors()) {
        if (ctx.subType === item.subType) {
            continue;
        }
        const headingKey = headingKeys[item.labelKey];
        addTurnInto(ctx, turnIntoSubmenu, {
            menuId: item.menuId,
            icon: item.icon,
            label: siyuanI18n[item.labelKey],
            accelerator: headingKey?.custom,
            type: "Blocks2Hs",
            level: item.level,
        });
    }
};

/**
 * 添加列表类型的转换菜单
 */

/** 生成空段落可直接转换的结构块菜单项。 */
/** @同步豁免: UI构建 */
export const buildEmptyParagraphTurnIntoMenu = (protyle: IProtyle, nodeElements: Element[]) => {
    if (nodeElements.length === 0 || !nodeElements.every(isEmptyParagraph)) {
        return [];
    }
    const insertKeys = getInsertKeymap();
    const items: IMenu[] = [];
    for (const item of getEmptyParagraphTargetDescriptors()) {
        const menuItem: IMenu = {
            id: item.id,
            icon: item.icon,
            label: siyuanI18n[item.labelKey],
            ...(item.id === "code" && insertKeys.code?.custom ? {accelerator: insertKeys.code.custom} : {}),
            ...(item.id === "table" && insertKeys.table?.custom ? {accelerator: insertKeys.table.custom} : {}),
            /** 将选中的空段落交给事务转换器，保持 undo 与焦点恢复语义。 */
            click() {
                turnEmptyParagraphsIntoTransaction({protyle, nodeElements, type: item.type});
            },
        };
        items.push(menuItem);
    }
    return items;
};

/**
 * 构建 Gutter 转换子菜单
 * 
 * @param ctx 转换菜单构建上下文
 * @returns 转换菜单项或 null
 */
/** @同步豁免: UI构建 */
export const buildGutterTurnIntoMenuItem = (ctx: IGutterTurnIntoContext) => {
    const { type, protyle } = ctx;
    const turnIntoSubmenu: IMenu[] = [];

    if (protyle.disabled) {
        return null;
    }

    const builders: Record<string, (ctx: IGutterTurnIntoContext, menu: IMenu[]) => void> = {
        "NodeParagraph": buildParagraphMenu,
        "NodeHeading": buildHeadingMenu,
        "NodeList": buildListMenu,
        "NodeBlockquote": buildBlockquoteMenu,
        "NodeCallout": buildCalloutMenu
    };

    const builder = builders[type];
    if (builder) {
        builder(ctx, turnIntoSubmenu);
    }
    turnIntoSubmenu.push(...buildEmptyParagraphTurnIntoMenu(protyle, [ctx.nodeElement]));

    if (turnIntoSubmenu.length === 0) {
        return null;
    }

    return {
        id: "turnInto",
        icon: "iconRefresh",
        label: siyuanI18n.turnInto,
        type: "submenu",
        submenu: turnIntoSubmenu
    };
};
