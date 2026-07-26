import { Constants } from "../../constants";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { hideElements } from "../ui/hideElements";
import { isMobile } from "../../util/platform/functions";
import {activeBlur} from "../../mobile/keyboard/activeBlur";
import { countBlockWord } from "../runtime/status.port";
import { MenuItem } from "../../menus/Menu.Item";
import { buildGutterTurnIntoMenuItem } from "./buildGutterTurnIntoMenu";
import { buildGutterAiMenu } from "./menus/buildGutterAiMenu";
import { buildGutterCopyMenuItem } from "./buildGutterCopyMenu";
import { buildGutterEditMenu } from "./buildGutterEditMenu";
import { buildGutterTypeSpecificMenu } from "./buildGutterTypeSpecificMenu";
import { buildGutterCommonMenu } from "./buildGutterCommonMenu";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { createProtyleMenuContext, scheduleProtyleMenuTask, setProtyleMenuContext } from "../runtime/menu.visibility";
import {getGutterNodeElement} from "./gutter.node";
import {getEmbedChildOperationContext} from "../wysiwyg/getBlock";
import {isEncryptedBox} from "../../util/pathName";
import {createAddBlocksToAgentMenuItem} from "./addBlockToAgent";
import type {IGutterMenuCapabilities} from "./gutter.types";

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
    const nodeElement = getGutterNodeElement(protyle, buttonElement);
    if (!nodeElement) {
        return;
    }
    const capabilities = getMenuCapabilities(protyle, nodeElement);
    const selectsElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (!capabilities.isEmbedMenu && selectsElement.length > 1) {
        setProtyleMenuContext(getSiyuanGlobalMenus().menu, createProtyleMenuContext({protyle}));
        return buildMultipleMenu(protyle, selectsElement, id);
    }
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BLOCK_SINGLE);
    return buildSingleMenu(protyle, nodeElement, id, capabilities);
};

/** 作用：计算嵌入查询边界内的结构修改与删除能力；调用时机：单块菜单构建前。 */
const getMenuCapabilities = (protyle: IProtyle, nodeElement: Element): IGutterMenuCapabilities => {
    const embedContext = getEmbedChildOperationContext(nodeElement);
    const allowStructuralMutation = !protyle.disabled &&
        (!embedContext || embedContext.targetElement !== nodeElement);
    const isOnlyTargetListItem = embedContext?.targetElement?.getAttribute("data-type") === "NodeList" &&
        nodeElement.getAttribute("data-type") === "NodeListItem" &&
        nodeElement.parentElement === embedContext.targetElement &&
        embedContext.targetElement.querySelectorAll(':scope > [data-type="NodeListItem"]').length === 1;
    return {
        isEmbedMenu: !!embedContext,
        allowStructuralMutation,
        allowRemoval: allowStructuralMutation && !isOnlyTargetListItem,
    };
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

const buildSingleMenu = (
    protyle: IProtyle,
    nodeElement: Element,
    id: string | null,
    capabilities: IGutterMenuCapabilities,
) => {
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
    if (capabilities.allowStructuralMutation) {
        addTurnIntoMenu(protyle, nodeElement, id, type, subType);
    }
    scheduleProtyleMenuTask(menuContext, () => {
        if (menuContext.host === "standalone" || capabilities.isEmbedMenu || isEncryptedBox(protyle.notebookId)) {
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
        protyle,
        allowDuplicate: capabilities.allowStructuralMutation,
    })).element);
    if (!capabilities.isEmbedMenu && !isMobile() && !isEncryptedBox(protyle.notebookId)) {
        getSiyuanGlobalMenus().menu.append(new MenuItem(createAddBlocksToAgentMenuItem([id || ""])).element);
    }
    if (!protyle.disabled || capabilities.isEmbedMenu) {
        for (const item of buildGutterEditMenu({protyle, nodeElement, ...capabilities})) {
            getSiyuanGlobalMenus().menu.append(new MenuItem(item).element);
        }
    }
    // 类型特定菜单属于可选能力，首屏菜单显示后再构建，避免复杂块类型阻塞基础编辑操作。
    scheduleProtyleMenuTask(menuContext, () => {
        if (capabilities.allowStructuralMutation) {
            buildGutterTypeSpecificMenu({protyle, nodeElement, id: id || "", type, subType, isEmbedMenu: capabilities.isEmbedMenu});
        }
    });
    // 通用操作菜单
    for (const item of buildGutterCommonMenu({protyle, nodeElement, id: id || "", type, ...capabilities})) {
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
