/**
 * 多选块外观及其它菜单构建模块
 * 从 buildGutterMultipleMenu.ts 拆分而来
 */
import { MenuItem } from "../../menus/Menu.Item";
import { isMobile } from "../../platform";
import { appearanceMenu } from "../toolbar/Font";
import { setPosition } from "../../util/DOM/setPosition";
import { emitOpenMenu } from "../../plugin/EventBus";
import { makeCard, quickMakeCard } from "../../card/makeCard";
import { getSiyuanConfig, incrementSiyuanZIndex } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterAlignMenu, buildGutterWidthsMenu } from "./buildGutterStyleMenu";
import { showMobileAppearance } from "./showMobileAppearance";
import { Constants } from "../../constants";
import { buildMultiAiMenu } from "./menus/buildGutterAiMenu";
import { buildGutterBackgroundMenu } from "./menus/buildGutterBackgroundMenu";

/**
 * 构建AI菜单（多块选择时）
 * 使用统一的 buildMultiAiMenu 保持子菜单结构一致性
 */
export const 构建AI菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    const aiMenu = buildMultiAiMenu(protyle, selectsElement);
    if (!aiMenu) {
        return;
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem(aiMenu).element);
};

/**
 * 构建外观菜单
 */
export const 构建外观菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    if (protyle.disabled) {
        return;
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_appearance", type: "separator" }).element);

    const backgroundMenu = buildGutterBackgroundMenu(selectsElement, protyle);
    if (backgroundMenu) {
        getSiyuanGlobalMenus().menu.append(new MenuItem(backgroundMenu).element);
    }

    const appearanceElement = new MenuItem({
        id: "appearance",
        label: siyuanI18n.appearance,
        icon: "iconFont",
        accelerator: getSiyuanConfig().keymap.editor.insert.appearance.custom,
        click: () => {
            if (isMobile) {
                showMobileAppearance(protyle);
                return;
            }
            protyle.toolbar.element.classList.add("fn__none");
            protyle.toolbar.subElement.innerHTML = "";
            protyle.toolbar.subElement.style.width = "";
            protyle.toolbar.subElement.style.padding = "";
            protyle.toolbar.subElement.append(appearanceMenu(protyle, selectsElement));
            protyle.toolbar.subElement.style.zIndex = incrementSiyuanZIndex().toString();
            protyle.toolbar.subElement.classList.remove("fn__none");
            protyle.toolbar.subElementCloseCB = undefined;
            const 第一个选中元素 = selectsElement[0];
            if (!第一个选中元素) {
                return;
            }
            const position = 第一个选中元素.getBoundingClientRect();
            setPosition(protyle.toolbar.subElement, position.left, position.top);
        }
    }).element;

    getSiyuanGlobalMenus().menu.append(appearanceElement);

    if (!isMobile) {
        appearanceElement.lastElementChild.classList.add("b3-menu__submenu--row");
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterAlignMenu(selectsElement, protyle)).element);
    const widthsMenu = buildGutterWidthsMenu(selectsElement, protyle);
    if (widthsMenu) {
        getSiyuanGlobalMenus().menu.append(new MenuItem(widthsMenu).element);
    }
};

/**
 * 构建闪卡菜单
 */
export const 构建闪卡菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    if (getSiyuanConfig().readonly) {
        return;
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "separator_quickMakeCard",
        type: "separator"
    }).element);

    const allCardsMade = !selectsElement.some(item =>
        !item.hasAttribute(Constants.CUSTOM_RIFF_DECKS) &&
        item.getAttribute("data-type") !== "NodeThematicBreak"
    );

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: allCardsMade ? "removeCard" : "quickMakeCard",
        protyle: {standalone: false, requires: ["flashcard"]},
        label: allCardsMade ? siyuanI18n.removeCard : siyuanI18n.quickMakeCard,
        accelerator: getSiyuanConfig().keymap.editor.general.quickMakeCard.custom,
        icon: "iconRiffCard",
        click() {
            quickMakeCard(protyle, selectsElement);
        }
    }).element);

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "addToDeck",
        protyle: {standalone: false, requires: ["flashcard"]},
        label: siyuanI18n.addToDeck,
        icon: "iconRiffCard",
        ignore: !getSiyuanConfig().flashcard.deck,
        click() {
            const ids: string[] = [];
            for (const item of selectsElement) {
                if (item.getAttribute("data-type") === "NodeThematicBreak") {
                    continue;
                }
                ids.push(item.getAttribute("data-node-id"));
            }
            makeCard(protyle.app, ids);
        }
    }).element);
};

/**
 * 触发插件菜单事件
 */
export const 触发插件菜单 = (protyle: IProtyle, selectsElement: Element[]): void => {
    if (!protyle?.app?.plugins?.length || window.siyuan?.standaloneProtyle) {
        return;
    }

    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "click-blockicon",
        detail: {
            protyle,
            blockElements: selectsElement,
        },
        separatorPosition: "top",
    });
};
