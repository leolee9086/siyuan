import { MenuItem } from "../../menus/Menu.Item";
import { Menu } from "../../menus/Menu";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMobile } from "../../util/functions";
import { reloadProtyle } from "../util/reload";
import { hideElements } from "../ui/hideElements";
import { fetchPost } from "../../util/fetch";
import { fullscreen } from "./action";
import { resize } from "../util/resize";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isInAndroid, isInHarmony } from "../util/compatibility";
import type { 录音器上下文 } from "./breadcrumb.types";
import { 添加上传菜单项, 添加录音菜单项 } from "./menuItems";

export function 添加上传与录音组(
    protyle: IProtyle,
    menu: Menu,
    录音上下文: 录音器上下文
) {
    if (!protyle.contentElement || protyle.contentElement.classList.contains("fn__none") || protyle.disabled) {
        return;
    }
    添加上传菜单项(protyle, menu);
    if (!isInAndroid() && !isInHarmony()) {
        添加录音菜单项(protyle, menu, 录音上下文);
    }
}

export function 添加懒加载菜单项(protyle: IProtyle, menu: Menu) {
    if (protyle.scroll && !protyle.scroll.element.classList.contains("fn__none")) {
        menu.append(new MenuItem({
            id: "keepLazyLoad",
            current: protyle.scroll.keepLazyLoad,
            label: siyuanI18n.keepLazyLoad,
            click: () => {
                if (protyle.scroll) {
                    protyle.scroll.keepLazyLoad = !protyle.scroll.keepLazyLoad;
                }
            }
        }).element);
    }
}

export function 添加刷新菜单项(protyle: IProtyle, menu: Menu) {
    if (menu.element.lastElementChild && menu.element.lastElementChild.childElementCount > 0) {
        menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }

    menu.append(new MenuItem({
        id: "refresh",
        icon: "iconRefresh",
        accelerator: getSiyuanConfig().keymap.editor.general.refresh.custom,
        label: siyuanI18n.refresh,
        click: () => {
            reloadProtyle(protyle, !isMobile());
        }
    }).element);
}

export function 添加优化排版菜单项(protyle: IProtyle, menu: Menu) {
    if (!protyle.disabled) {
        menu.append(new MenuItem({
            id: "optimizeTypography",
            label: siyuanI18n.optimizeTypography,
            accelerator: getSiyuanConfig().keymap.editor.general.optimizeTypography.custom,
            icon: "iconFormat",
            click: () => {
                hideElements(["toolbar"], protyle);
                fetchPost("/api/format/autoSpace", {
                    id: protyle.block.rootID
                });
            }
        }).element);
    }
}

export function 添加全屏菜单项(protyle: IProtyle, menu: Menu) {
    /// #if !MOBILE
    menu.append(new MenuItem({
        id: "fullscreen",
        icon: protyle.element.className.includes("fullscreen") ? "iconFullscreenExit" : "iconFullscreen",
        accelerator: getSiyuanConfig().keymap.editor.general.fullscreen.custom,
        label: siyuanI18n.fullscreen,
        click: () => {
            fullscreen(protyle.element);
            resize(protyle);
        }
    }).element);
    /// #endif
}
//@AIDONE label不应该书写为一行,难以阅读
export function 添加文档信息菜单项(menu: Menu, response: IWebSocketData) {
    if (!response.data || !response.data.stat) {
        return;
    }
    menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    menu.append(new MenuItem({
        id: "docInfo",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex">${siyuanI18n.runeCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.runeCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.wordCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.wordCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.linkCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.linkCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.imgCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.imageCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.refCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.refCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.blockCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.blockCount}</div>`,
    }).element);
}
