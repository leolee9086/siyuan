import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type {IGutterTurnIntoContext} from "./gutter.types";
import {genTurnsOneInto} from "./turnInto/items";

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

const getHeadingKeymap = () => {
    return getSiyuanConfig().keymap.editor.heading;
};

/**
 * 添加引用块类型的转换菜单
 */
export const buildBlockquoteMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const headingKeys = getHeadingKeymap();

    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "paragraph",
        icon: "iconParagraph",
        label: siyuanI18n.paragraph,
        accelerator: headingKeys.paragraph.custom,
        type: "CancelBlockquote"
    });
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "callout",
        icon: "iconCallout",
        label: (siyuanI18n as any).callout || "Callout",
        type: "Blockquote2Callout"
    });
};

/**
 * 添加提示块类型的转换菜单
 */
export const buildCalloutMenu = (ctx: IGutterTurnIntoContext, turnIntoSubmenu: IMenu[]) => {
    const headingKeys = getHeadingKeymap();

    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "paragraph",
        icon: "iconParagraph",
        label: siyuanI18n.paragraph,
        accelerator: headingKeys.paragraph.custom,
        type: "CancelCallout"
    });
    addTurnsOneInto(ctx, turnIntoSubmenu, {
        menuId: "quote",
        icon: "iconQuote",
        label: siyuanI18n.quote,
        type: "Callout2Blockquote"
    });
};
