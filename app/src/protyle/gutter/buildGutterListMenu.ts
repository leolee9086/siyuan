import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type {IGutterTurnIntoContext} from "./gutter.types";
import {genTurnsIntoOne, genTurnsOneInto} from "./turnInto/items";
import {turnListsRecursively} from "../wysiwyg/transaction/transforms/list";

type TTurnIntoOne = "BlocksMergeSuperBlock" | "Blocks2ULs" | "Blocks2OLs" | "Blocks2TLs" | "Blocks2Blockquote" | "Blocks2Callout";
type TTurnIntoOneSub = "row" | "col";

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

const addTurnsOneInto = (
    ctx: IGutterTurnIntoContext,
    target: IMenu[],
    options: {
        menuId: string;
        icon: string;
        label: string;
        accelerator?: string;
        type: string;
    }
) => {
    target.push(genTurnsOneInto({
        menuId: options.menuId,
        id: ctx.id,
        icon: options.icon,
        label: options.label,
        protyle: ctx.protyle,
        nodeElement: ctx.nodeElement,
        type: options.type
    }));
};

const getInsertKeymap = () => {
    return getSiyuanConfig().keymap.editor.insert;
};

const getHeadingKeymap = () => {
    return getSiyuanConfig().keymap.editor.heading;
};

const buildOrderedListItems = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "list",
        icon: "iconList",
        label: siyuanI18n.list,
        accelerator: insertKeys.list.custom,
        type: "OL2UL"
    });
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "check",
        icon: "iconCheck",
        label: siyuanI18n.check,
        accelerator: insertKeys.check.custom,
        type: "UL2TL"
    });
};

const buildTaskListItems = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const orderedListConfig = insertKeys["ordered-list"];
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "list",
        icon: "iconList",
        label: siyuanI18n.list,
        accelerator: insertKeys.list.custom,
        type: "TL2UL"
    });
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "orderedList",
        icon: "iconOrderedList",
        label: siyuanI18n["ordered-list"],
        accelerator: orderedListConfig.custom,
        type: "TL2OL"
    });
};

const buildUnorderedListItems = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const orderedListConfig = insertKeys["ordered-list"];
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "orderedList",
        icon: "iconOrderedList",
        label: siyuanI18n["ordered-list"],
        accelerator: orderedListConfig.custom,
        type: "UL2OL"
    });
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "check",
        icon: "iconCheck",
        label: siyuanI18n.check,
        accelerator: insertKeys.check.custom,
        type: "OL2TL"
    });
};

/**
 * 添加列表类型的转换菜单
 */
export const buildListMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const insertKeys = getInsertKeymap();
    const headingKeys = getHeadingKeymap();

    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "paragraph",
        icon: "iconParagraph",
        label: siyuanI18n.paragraph,
        accelerator: headingKeys.paragraph.custom,
        type: "CancelList"
    });

    // Check for quote existing
    const quoteKey = insertKeys.quote ? insertKeys.quote.custom : "";
    const calloutLabel = (siyuanI18n as any).callout || "Callout";

    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "quote",
        icon: "iconQuote",
        label: siyuanI18n.quote,
        accelerator: quoteKey,
        type: "Blocks2Blockquote"
    });
    addTurnIntoOne(ctx, turnIntoSubmenu, {
        menuId: "callout",
        icon: "iconCallout",
        label: calloutLabel,
        type: "Blocks2Callout"
    });

    const listSubType = ctx.nodeElement.getAttribute("data-subtype");
    // S-Forge: 上游递归转换语义，包含子列表
    const listElements = [ctx.nodeElement];
    const recursiveSubmenu: IMenu[] = [{
        id: "recursiveParagraph",
        icon: "iconParagraph",
        label: siyuanI18n.paragraph,
        click() {
            turnListsRecursively({
                protyle: ctx.protyle,
                nodeElements: listElements,
                type: "CancelListRecursively"
            });
        }
    }];

    if (listSubType === "o") { // Ordered list
        buildOrderedListItems(ctx, turnIntoSubmenu);
        recursiveSubmenu.push({
            id: "recursiveList",
            icon: "iconList",
            label: siyuanI18n.list,
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "u"
                });
            }
        });
        recursiveSubmenu.push({
            id: "recursiveCheck",
            icon: "iconCheck",
            label: siyuanI18n.check,
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "t"
                });
            }
        });
    } else if (listSubType === "t") { // Task list
        buildTaskListItems(ctx, turnIntoSubmenu);
        recursiveSubmenu.push({
            id: "recursiveList",
            icon: "iconList",
            label: siyuanI18n.list,
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "u"
                });
            }
        });
        recursiveSubmenu.push({
            id: "recursiveOrderedList",
            icon: "iconOrderedList",
            label: siyuanI18n["ordered-list"],
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "o"
                });
            }
        });
    } else { // Unordered list (default)
        buildUnorderedListItems(ctx, turnIntoSubmenu);
        recursiveSubmenu.push({
            id: "recursiveOrderedList",
            icon: "iconOrderedList",
            label: siyuanI18n["ordered-list"],
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "o"
                });
            }
        });
        recursiveSubmenu.push({
            id: "recursiveCheck",
            icon: "iconCheck",
            label: siyuanI18n.check,
            click() {
                turnListsRecursively({
                    protyle: ctx.protyle,
                    nodeElements: listElements,
                    type: "ConvertListType",
                    targetListType: "t"
                });
            }
        });
    }

    turnIntoSubmenu.push({
        id: "includeSublists",
        icon: "iconListItem",
        label: siyuanI18n.includeSublists,
        type: "submenu",
        submenu: recursiveSubmenu
    });
};
