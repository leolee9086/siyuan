/**
 * Gutter 块菜单 - 通用操作菜单构建模块
 * 从 renderMenu 提取的通用操作菜单构建逻辑
 * 
 * @fileoverview 提供 Gutter 块菜单中进入、插入、跳转、折叠、外观、闪卡等通用菜单项的构建功能
 * @module protyle/gutter/buildGutterCommonMenu
 */

import { isMobile } from "../../platform";
import * as dayjs from "dayjs";
import { foldHeadingGroup, setFold } from "../util/blockFold";
import { enterBack } from "../../menus/protyleMenus/editorMenu/protyle.enterBack";
import {openAttr} from "../../menus/commonMenuItem/fileAttr/openAttr";
import { openWechatNotify } from "../../menus/commonMenuItem/commonMenuItem.openWechatNotify";
import { updateHotkeyAfterTip, updateHotkeyTip } from "../util/compatibility";
import { focusBlock } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import { getContenteditableElement } from "../wysiwyg/getBlock";
import { insertEmptyBlock, jumpToParent } from "../../block/util";
import { countBlockWord } from "../runtime/status.port";
import { Constants } from "../../constants";
import { makeCard, quickMakeCard } from "../../card/makeCard";
import { transferBlockRef } from "../../menus/block";
import { appearanceMenu } from "../toolbar/Font";
import { setPosition } from "../../util/DOM/positioning/setPosition";
import { emitOpenMenu } from "../../plugin/menu/emitOpenMenu.factory";
import { getSiyuanConfig, incrementSiyuanZIndex } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterAlignMenu, buildGutterWidthsMenu } from "./buildGutterStyleMenu";
import { showMobileAppearance } from "./showMobileAppearance";
import { openFileById } from "../../editor/utils.openFileById";
import {checkFold} from "../../block/fold/checkFold";
import { 添加格式刷菜单 } from "./buildGutterStyleBrushMenu";
import { exportImage } from "./imports";
import { buildGutterBackgroundMenu } from "./menus/buildGutterBackgroundMenu";
import { getProtyleMenuContext, scheduleProtyleMenuTask } from "../runtime/menu.visibility";
import { createBlockColorMenuItem } from "../../sforge/colors/menu";
import {isEncryptedBox} from "../../util/file/notebook/store";
import type {IGutterCommonMenuContext} from "./gutter.types";

/**
 * 创建进入菜单项（非反链模式）
 */
const 创建进入菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "enter",
    protyle: {standalone: false, requires: ["navigation"]},
    accelerator: `${getSiyuanConfig().keymap.general.enter.custom ? updateHotkeyTip(getSiyuanConfig().keymap.general.enter.custom) + "/" : ""}${updateHotkeyAfterTip("⌘" + siyuanI18n.click)}`,
    label: siyuanI18n.enter,
    click: () => {
        ctx.protyle.getInstance().zoomOut({id: ctx.id});
    }
});

/**
 * 创建返回上一层菜单项
 */
const 创建返回菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "enterBack",
    protyle: {standalone: false, requires: ["navigation"]},
    accelerator: getSiyuanConfig().keymap.general.enterBack.custom,
    label: siyuanI18n.enterBack,
    click: () => {
        enterBack(ctx.protyle, ctx.id);
    }
});

/**
 * 创建反链模式下的打开菜单项
 */
const 创建反链打开菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "enter",
    protyle: {standalone: false, requires: ["navigation"]},
    accelerator: `${updateHotkeyTip(getSiyuanConfig().keymap.general.enter.custom)}/${updateHotkeyTip("⌘" + siyuanI18n.click)}`,
    label: siyuanI18n.openBy,
    click: () => {
        // @内联回调
        checkFold(ctx.id, (zoomIn, action) => {
            if (isMobile) {
                return;
            }
            openFileById({
                app: ctx.protyle.app,
                id: ctx.id,
                action,
                zoomIn
            });
        });
    }
});

/**
 * 创建在上方插入菜单项
 */
const 创建插入上方菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "insertBefore",
    icon: "iconBefore",
    label: siyuanI18n.insertBefore,
    accelerator: getSiyuanConfig().keymap.editor.general.insertBefore.custom,
    click() {
        hideElements(["select"], ctx.protyle);
        countBlockWord([], ctx.protyle.block.rootID, false, ctx.protyle.options.status);
        insertEmptyBlock(ctx.protyle, "beforebegin", ctx.id);
    }
});

/**
 * 创建在下方插入菜单项
 */
const 创建插入下方菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "insertAfter",
    icon: "iconAfter",
    label: siyuanI18n.insertAfter,
    accelerator: getSiyuanConfig().keymap.editor.general.insertAfter.custom,
    click() {
        hideElements(["select"], ctx.protyle);
        countBlockWord([], ctx.protyle.block.rootID, false, ctx.protyle.options.status);
        insertEmptyBlock(ctx.protyle, "afterend", ctx.id);
    }
});

/**
 * 创建跳转子菜单
 */
const 创建跳转菜单 = (ctx: IGutterCommonMenuContext) => ({
    id: "jumpTo",
    type: "submenu",
    label: siyuanI18n.jumpTo,
    submenu: [{
        id: "jumpToParentPrev",
        iconHTML: "",
        label: siyuanI18n.jumpToParentPrev,
        accelerator: getSiyuanConfig().keymap.editor.general.jumpToParentPrev.custom,
        click() {
            hideElements(["select"], ctx.protyle);
            jumpToParent(ctx.protyle, ctx.nodeElement, "previous");
        }
    }, {
        iconHTML: "",
        id: "jumpToParentNext",
        label: siyuanI18n.jumpToParentNext,
        accelerator: getSiyuanConfig().keymap.editor.general.jumpToParentNext.custom,
        click() {
            hideElements(["select"], ctx.protyle);
            jumpToParent(ctx.protyle, ctx.nodeElement, "next");
        }
    }, {
        iconHTML: "",
        id: "jumpToParent",
        label: siyuanI18n.jumpToParent,
        accelerator: getSiyuanConfig().keymap.editor.general.jumpToParent.custom,
        click() {
            hideElements(["select"], ctx.protyle);
            jumpToParent(ctx.protyle, ctx.nodeElement, "parent");
        }
    }]
});

/**
 * 创建折叠菜单项
 */
const 创建折叠菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "fold",
    icon: "iconFoldUnFold",
    label: siyuanI18n.fold,
    accelerator: ctx.type === "NodeHeading" ? updateHotkeyTip(getSiyuanConfig().keymap.editor.general.collapse.custom) :
        `${updateHotkeyTip(getSiyuanConfig().keymap.editor.general.collapse.custom)}/${updateHotkeyTip("⌥" + siyuanI18n.click)}`,
    click() {
        setFold(ctx.protyle, ctx.nodeElement);
        focusBlock(ctx.nodeElement);
    }
});

const 创建折叠直接子标题菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "foldChildHeadings",
    icon: "iconHeadings",
    label: siyuanI18n.foldChildHeadings,
    accelerator: getSiyuanConfig().keymap.editor.general.foldChildHeadings?.custom || "",
    async click() {
        await foldHeadingGroup(ctx.protyle, ctx.nodeElement, "children");
        focusBlock(ctx.nodeElement);
    }
});

const 创建折叠同级标题菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "foldSiblingHeadings",
    icon: "iconHeadings",
    label: siyuanI18n.foldSiblingHeadings,
    accelerator: (() => {
        const custom = getSiyuanConfig().keymap.editor.general.foldSiblingHeadings?.custom || "";
        const clickTip = updateHotkeyTip("⌥" + siyuanI18n.click);
        return custom ? `${custom}/${clickTip}` : clickTip;
    })(),
    async click() {
        await foldHeadingGroup(ctx.protyle, ctx.nodeElement, "siblings");
        focusBlock(ctx.nodeElement);
    }
});

/**
 * 创建属性菜单项
 */
const 创建属性菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "attr",
    protyle: {standalone: false, requires: ["dialogs"]},
    label: siyuanI18n.attr,
    icon: "iconAttr",
    accelerator: getSiyuanConfig().keymap.editor.general.attr.custom + "/" + updateHotkeyTip("⇧" + siyuanI18n.click),
    click() {
        openAttr(ctx.nodeElement, "bookmark", ctx.protyle);
    }
});

/**
 * 创建外观菜单项
 * @returns 外观菜单项的 DOM 元素
 */
const 创建外观菜单 = (ctx: IGutterCommonMenuContext) => ({
    id: "appearance",
    label: siyuanI18n.appearance,
    icon: "iconFont",
    accelerator: getSiyuanConfig().keymap.editor.insert.appearance.custom,
    click: () => {
        if (isMobile) {
            showMobileAppearance(ctx.protyle);
            return;
        }
        ctx.protyle.toolbar.element.classList.add("fn__none");
        ctx.protyle.toolbar.subElement.innerHTML = "";
        ctx.protyle.toolbar.subElement.style.width = "";
        ctx.protyle.toolbar.subElement.style.padding = "";
        ctx.protyle.toolbar.subElement.append(appearanceMenu(ctx.protyle, [ctx.nodeElement]));
        ctx.protyle.toolbar.subElement.style.zIndex = incrementSiyuanZIndex().toString();
        ctx.protyle.toolbar.subElement.classList.remove("fn__none");
        ctx.protyle.toolbar.subElementCloseCB = undefined;
        const position = ctx.nodeElement.getBoundingClientRect();
        setPosition(ctx.protyle.toolbar.subElement, position.left, position.top);
    }
});

/**
 * 创建微信提醒菜单项
 */
const 创建微信提醒菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "wechatReminder",
    protyle: {standalone: false, requires: ["dialogs"]},
    icon: "iconMp",
    label: siyuanI18n.wechatReminder,
    ignore: getSiyuanConfig().readonly,
    click() {
        openWechatNotify(ctx.nodeElement);
    }
});

/**
 * 创建闪卡菜单项
 */
const 创建闪卡菜单项 = (ctx: IGutterCommonMenuContext) => {
    const isCardMade = ctx.nodeElement.hasAttribute(Constants.CUSTOM_RIFF_DECKS);
    return {
        id: isCardMade ? "removeCard" : "quickMakeCard",
        protyle: {standalone: false, requires: ["flashcard"]},
        icon: "iconRiffCard",
        label: isCardMade ? siyuanI18n.removeCard : siyuanI18n.quickMakeCard,
        accelerator: getSiyuanConfig().keymap.editor.general.quickMakeCard.custom,
        click() {
            quickMakeCard(ctx.protyle, [ctx.nodeElement]);
        }
    };
};

/**
 * 创建添加到卡组菜单项
 */
const 创建添加到卡组菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "addToDeck",
    protyle: {standalone: false, requires: ["flashcard"]},
    label: siyuanI18n.addToDeck,
    ignore: !getSiyuanConfig().flashcard.deck,
    icon: "iconRiffCard",
    click() {
        makeCard(ctx.protyle.app, [ctx.id]);
    }
});

/**
 * 创建时间戳菜单项
 */
const 创建时间戳菜单项 = (ctx: IGutterCommonMenuContext) => {
    let updateHTML = ctx.nodeElement.getAttribute("updated") || "";
    if (updateHTML) {
        updateHTML = `${siyuanI18n.modifiedAt} ${dayjs(updateHTML).format("YYYY-MM-DD HH:mm:ss")}<br>`;
    }
    return {
        id: "updateAndCreatedAt",
        iconHTML: "",
        type: "readonly",
        label: `${updateHTML}${siyuanI18n.createdAt} ${dayjs(ctx.id.substr(0, 14)).format("YYYY-MM-DD HH:mm:ss")}`,
    };
};

/**
 * 创建导出图片菜单项
 */
const 创建导出图片菜单项 = (ctx: IGutterCommonMenuContext) => ({
    id: "exportImage",
    protyle: {standalone: false, requires: ["export"]},
    label: siyuanI18n.exportAsImage,
    icon: "iconImage",
    click() {
        exportImage(ctx.id);
    }
});

/**
 * 检查是否应该显示微信提醒菜单
 */
const 应该显示微信提醒 = (ctx: IGutterCommonMenuContext): boolean => {
    const excludeTypes = ["NodeThematicBreak", "NodeBlockQueryEmbed", "NodeIFrame", "NodeHTMLBlock", "NodeWidget", "NodeVideo", "NodeAudio"];
    if (getSiyuanConfig().cloudRegion !== 0) {
        return false;
    }
    if (excludeTypes.includes(ctx.type)) {
        return false;
    }
    if (getContenteditableElement(ctx.nodeElement)?.textContent.trim() === "") {
        return false;
    }
    if (ctx.type === "NodeCodeBlock" && ctx.nodeElement.getAttribute("data-subtype")) {
        return false;
    }
    return true;
};

/**
 * 添加导航菜单项（进入/返回）
 */
const 添加导航菜单 = (ctx: IGutterCommonMenuContext, menuItems: IMenu[]) => {
    if (ctx.protyle.options.backlinkData && !isMobile) {
        menuItems.push(创建反链打开菜单项(ctx));
    }
    if (!ctx.protyle.options.backlinkData) {
        menuItems.push(创建进入菜单项(ctx));
        menuItems.push(创建返回菜单项(ctx));
    }
};

/**
 * 添加编辑菜单项（插入/引用计数）
 */
const 添加编辑菜单 = (ctx: IGutterCommonMenuContext, menuItems: IMenu[]) => {
    if (!ctx.allowStructuralMutation) {
        return;
    }
    menuItems.push(创建插入上方菜单项(ctx));
    menuItems.push(创建插入下方菜单项(ctx));

    const countElement = ctx.nodeElement.lastElementChild?.querySelector(".protyle-attr--refcount");
    if (countElement && countElement.textContent) {
        transferBlockRef(ctx.id);
    }
};

/**
 * 添加视图菜单项（折叠/属性/外观/格式刷）
 */
const 添加视图菜单 = (ctx: IGutterCommonMenuContext, menuItems: IMenu[]) => {
    if (ctx.type !== "NodeThematicBreak") {
        menuItems.push(创建折叠菜单项(ctx));
        if (ctx.type === "NodeHeading") {
            menuItems.push(创建折叠直接子标题菜单项(ctx));
            menuItems.push(创建折叠同级标题菜单项(ctx));
        }
    }
    if (ctx.type !== "NodeThematicBreak" && !ctx.protyle.disabled && !isEncryptedBox(ctx.protyle.notebookId)) {
        menuItems.push(创建属性菜单项(ctx));
    }
    if (!ctx.protyle.disabled) {
        const backgroundMenu = buildGutterBackgroundMenu([ctx.nodeElement], ctx.protyle);
        if (backgroundMenu) {
            menuItems.push(backgroundMenu);
        }
        menuItems.push(创建外观菜单(ctx));
        menuItems.push(buildGutterAlignMenu([ctx.nodeElement], ctx.protyle));
        const widthsMenu = buildGutterWidthsMenu([ctx.nodeElement], ctx.protyle);
        if (widthsMenu) {
            menuItems.push(widthsMenu);
        }
        // [S-Forge] 格式刷菜单项
        添加格式刷菜单(ctx, menuItems);
    }
};

/**
 * 添加扩展菜单项（微信/闪卡/插件）
 */
const 添加扩展菜单 = (ctx: IGutterCommonMenuContext, menuItems: IMenu[]) => {
    menuItems.push(createBlockColorMenuItem(ctx.nodeElement));
    if (应该显示微信提醒(ctx)) {
        menuItems.push(创建微信提醒菜单项(ctx));
    }
    if (ctx.type !== "NodeThematicBreak" && !getSiyuanConfig().readonly && !isEncryptedBox(ctx.protyle.notebookId)) {
        menuItems.push(创建闪卡菜单项(ctx));
        menuItems.push(创建添加到卡组菜单项(ctx));
        menuItems.push({ id: "separator_5", type: "separator" });
    }
    const menuContext = getProtyleMenuContext();
    if (!ctx.isEmbedMenu && menuContext?.host === "full-app" && ctx.protyle?.app?.plugins?.length) {
        scheduleProtyleMenuTask(menuContext, () => {
            emitOpenMenu({
                plugins: ctx.protyle.app.plugins,
                type: "click-blockicon",
                detail: {
                    protyle: ctx.protyle,
                    blockElements: [ctx.nodeElement]
                },
                separatorPosition: "bottom",
            });
        });
    }
};

/**
 * 构建 Gutter 通用操作菜单
 * 
 * @param ctx 通用菜单构建上下文
 * @returns 通用操作菜单项数组
 */
export const buildGutterCommonMenu = (ctx: IGutterCommonMenuContext): IMenu[] => {
    const menuItems: IMenu[] = [];

    menuItems.push({ id: "separator_2", type: "separator" });
    添加导航菜单(ctx, menuItems);
    添加编辑菜单(ctx, menuItems);
    if (!ctx.isEmbedMenu) {
        menuItems.push(创建跳转菜单(ctx));
    }
    menuItems.push({ id: "separator_3", type: "separator" });
    添加视图菜单(ctx, menuItems);
    menuItems.push(创建导出图片菜单项(ctx));
    menuItems.push({ id: "separator_4", type: "separator" });
    添加扩展菜单(ctx, menuItems);
    menuItems.push(创建时间戳菜单项(ctx));

    return menuItems;
};
