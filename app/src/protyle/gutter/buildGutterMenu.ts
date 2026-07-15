import { Constants } from "../../constants";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { isInEmbedBlock } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { isMobile } from "../../util/platform/functions";
import { activeBlur } from "../../mobile/util/keyboardToolbar";
import { countBlockWord } from "../../layout/status";
import { MenuItem } from "../../menus/Menu.Item";
import { buildGutterTurnIntoMenuItem } from "./buildGutterTurnIntoMenu";
import { buildGutterAiMenu } from "./menus/buildGutterAiMenu";
import { buildGutterCopyMenuItem } from "./buildGutterCopyMenu";
import { buildGutterEditMenu } from "./buildGutterEditMenu";
import { buildGutterTypeSpecificMenu } from "./buildGutterTypeSpecificMenu";
import { buildGutterCommonMenu } from "./buildGutterCommonMenu";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { createProtyleMenuContext, scheduleProtyleMenuTask, setProtyleMenuContext } from "../runtime/menu.visibility";

export const buildGutterMenu = (options: {
    protyle: IProtyle;
    buttonElement: Element;
}) => {
    const { protyle, buttonElement } = options;
    if (!buttonElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    getSiyuanGlobalMenus().menu.remove();
    if (isMobile()) {
        activeBlur();
    }
    const id = buttonElement.getAttribute("data-node-id");
    const selectsElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectsElement.length > 1) {
        setProtyleMenuContext(getSiyuanGlobalMenus().menu, createProtyleMenuContext({protyle}));
        return buildMultipleMenu(protyle, selectsElement, id);
    }
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BLOCK_SINGLE);
    return buildSingleMenu(protyle, buttonElement, id);
};

const buildMultipleMenu = (protyle: IProtyle, selectsElement: NodeListOf<Element>, id: string | null) => {
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BLOCK_MULTI);
    const match = Array.from(selectsElement).find(item => {
        if (id && id === item.getAttribute("data-node-id")) {
            return true;
        }
    });
    if (match) {
        return buildGutterMultipleMenu({ protyle, selectsElement: Array.from(selectsElement) });
    }
};

const buildSingleMenu = (protyle: IProtyle, buttonElement: Element, id: string | null) => {
    const nodeElement = findNodeElement(protyle, buttonElement, id);
    if (!nodeElement) {
        return;
    }
    const type = nodeElement.getAttribute("data-type");
    const subType = nodeElement.getAttribute("data-subtype");
    const menuContext = createProtyleMenuContext({
        protyle,
        nodeElement,
        nodeType: type,
        nodeSubType: subType,
    });
    setProtyleMenuContext(getSiyuanGlobalMenus().menu, menuContext);
    hideElements(["select"], protyle);
    nodeElement.classList.add("protyle-wysiwyg--select");
    addTurnIntoMenu(protyle, nodeElement, id, type, subType);
    scheduleProtyleMenuTask(menuContext, () => {
        if (menuContext.host === "standalone") {
            return;
        }
        const aiMenuItem = buildGutterAiMenu({protyle, nodeElement});
        if (aiMenuItem) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(aiMenuItem).element);
        }
    });

    getSiyuanGlobalMenus().menu.append(new MenuItem(buildGutterCopyMenuItem({
        nodeElement,
        type,
        id: id || "",
        protyle
    })).element);
    if (!protyle.disabled) {
        for (const item of buildGutterEditMenu({ protyle, nodeElement })) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
        }
    }
    // 类型特定菜单属于可选能力，首屏菜单显示后再构建，避免复杂块类型阻塞基础编辑操作。
    scheduleProtyleMenuTask(menuContext, () => {
        buildGutterTypeSpecificMenu({protyle, nodeElement, id: id || "", type, subType});
    });
    // 通用操作菜单
    for (const item of buildGutterCommonMenu({ protyle, nodeElement, id: id || "", type })) {
        getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
    }
    return getSiyuanGlobalMenus().menu;
};

const addTurnIntoMenu = (protyle: IProtyle, nodeElement: Element, id: string | null, type: string | null, subType: string | null) => {
    if (!id) {
        return;
    }
    countBlockWord([id], protyle.block.rootID, false, protyle.options.status);
    const turnIntoSubmenu = buildGutterTurnIntoMenuItem({
        nodeElement,
        id,
        type,
        subType,
        protyle,
    });
    if (turnIntoSubmenu) {
        getSiyuanGlobalMenus().menu.append(new MenuItem(turnIntoSubmenu).element);
    }
};

const findNodeElement = (protyle: IProtyle, buttonElement: Element, id: string | null) => {
    if (buttonElement.tagName !== "BUTTON") {
        return buttonElement;
    }
    if (!id || !protyle.wysiwyg?.element || !protyle.gutter) {
        return;
    }
    return Array.from(protyle.wysiwyg!.element.querySelectorAll(`[data-node-id="${id}"]`)).find(item => {
        if (!isInEmbedBlock(item) && protyle.gutter!.isMatchNode(item)) {
            return true;
        }
    });
};
