/**
 * 构建基于节点类型的特殊菜单
 * 从 renderMenu 函数中提取的类型特定菜单逻辑
 */
import { Menu } from "../../menus/Menu";
import { MenuItem } from "../../menus/Menu.Item";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterSuperBlockMenu } from "./buildGutterSuperBlockMenu";
import { buildGutterCodeBlockMenu } from "./buildGutterCodeBlockMenu";
import { buildGutterChartMenu } from "./buildGutterChartMenu";
import { buildGutterTableMenu } from "./buildGutterTableMenu";
import { buildGutterAvMenu } from "./buildGutterAvMenu";
import { buildGutterMediaMenu } from "./buildGutterHtmlMenu";
import { buildGutterEmbedMenu } from "./buildGutterEmbedMenu";
import { buildGutterHeadingMenu } from "./buildGutterHeadingMenu";
import { isProtyleMenuItemVisible } from "../runtime/menu.visibility";
import { appendListItem, openOrderedListStartDialog, prependListItem, setOrderedListStart } from "../wysiwyg/list";
import { fetchSyncPost } from "../../util/network/fetch";
import { hideElements } from "../ui/hideElements";
import { countBlockWord } from "../runtime/status.port";
import { getEditorRange } from "../util/selection";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";


interface ITypeSpecificMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    id: string;
    type: string;
    subType: string | null;
    isEmbedMenu?: boolean;
}

const shouldBuildFullAppMenu = () => isProtyleMenuItemVisible({protyle: {standalone: false}});

/** 将菜单项数组追加到菜单 */
function appendMenuItems(menu: Menu, items: IMenu[]): void {
    for (const item of items) {
        menu.append(new MenuItem(item).element);
    }
}


/** 处理超级块菜单 */
function handleSuperBlockMenu(protyle: IProtyle, nodeElement: Element): boolean {
    if (protyle.disabled) {
return false;
}
    const menu = getSiyuanGlobalMenus().menu;
    menu.append(new MenuItem({
        id: "separator_cancelSuperBlock",
        type: "separator"
    }).element);
    appendMenuItems(menu, buildGutterSuperBlockMenu(protyle, nodeElement));
    return true;
}

/** 处理代码块菜单 */
function handleCodeBlockMenu(protyle: IProtyle, nodeElement: Element, id: string): boolean {
    if (protyle.disabled) {
return false;
}
    const subtype = nodeElement.getAttribute("data-subtype") || "";
    const menu = getSiyuanGlobalMenus().menu;

    // 普通代码块
    if (!subtype) {
        menu.append(new MenuItem({ id: "separator_code", type: "separator" }).element);
        menu.append(new MenuItem({
            id: "code",
            type: "submenu",
            icon: "iconCode",
            label: siyuanI18n.code,
            submenu: buildGutterCodeBlockMenu({ nodeElement, id })
        }).element);
        return true;
    }

    // 图表（echarts/mindmap）
    if (["echarts", "mindmap"].includes(subtype)) {
        menu.append(new MenuItem({ id: "separator_chart", type: "separator" }).element);
        menu.append(new MenuItem(buildGutterChartMenu({ protyle, nodeElement, id })).element);
        return true;
    }

    return false;
}

/** 处理表格菜单 */
function handleTableMenu(protyle: IProtyle, nodeElement: Element): boolean {
    if (protyle.disabled) {
return false;
}
    appendMenuItems(getSiyuanGlobalMenus().menu, buildGutterTableMenu(protyle, nodeElement));
    return true;
}

/** 处理属性视图菜单 */
function handleAttributeViewMenu(protyle: IProtyle, nodeElement: Element, id: string): boolean {
    if (!shouldBuildFullAppMenu()) {
        return false;
    }
    appendMenuItems(getSiyuanGlobalMenus().menu, buildGutterAvMenu(protyle, nodeElement, id));
    return true;
}

/** 处理媒体菜单（视频、音频、iframe、HTML块） */
function handleMediaMenu(protyle: IProtyle, nodeElement: Element, type: string): boolean {
    if (protyle.disabled) {
return false;
}
    if (!shouldBuildFullAppMenu()) {
        return false;
    }
    appendMenuItems(getSiyuanGlobalMenus().menu, buildGutterMediaMenu(protyle, nodeElement, type));
    return true;
}

/** 处理嵌入块菜单 */
function handleEmbedMenu(protyle: IProtyle, nodeElement: Element, id: string): boolean {
    if (protyle.disabled) {
return false;
}
    if (!shouldBuildFullAppMenu()) {
        return false;
    }
    const menu = getSiyuanGlobalMenus().menu;
    menu.append(new MenuItem({ id: "separator_blockEmbed", type: "separator" }).element);
    menu.append(new MenuItem(buildGutterEmbedMenu(protyle, nodeElement, id)).element);
    return true;
}

/** 处理标题菜单 */
function handleHeadingMenu(
    protyle: IProtyle,
    nodeElement: Element,
    id: string,
    subType: string | null,
    isEmbedMenu: boolean,
): boolean {
    if (protyle.disabled) {
return false;
}
    const menu = getSiyuanGlobalMenus().menu;
    const { 标题级别转换, 其他操作 } = buildGutterHeadingMenu({
        protyle,
        id,
        subType: subType as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
        nodeElement,
        isEmbedMenu,
    });

    if (标题级别转换.length > 0) {
        menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
        menu.append(new MenuItem({
            id: "tWithSubtitle",
            type: "submenu",
            icon: "iconRefresh",
            label: siyuanI18n.tWithSubtitle,
            submenu: 标题级别转换
        }).element);
    }

    for (const item of 其他操作) {
        menu.append(new MenuItem(item).element);
    }
    return true;
}

/** 处理列表块菜单（NodeList / NodeListItem） */
function handleListBlockMenu(protyle: IProtyle, nodeElement: Element, id: string, type: string): boolean {
    if (protyle.disabled) {
        return false;
    }
    const isOrderedList = type === "NodeList" && nodeElement.getAttribute("data-subtype") === "o";
    const range = getEditorRange(nodeElement as HTMLElement);
    const continueListStartPromise = isOrderedList ? fetchSyncPost("/api/block/getOrderedListContinueStart", {
        id,
        notebook: protyle.notebookId,
    }).then((response) => {
        const start = (response.data as any)?.start;
        return (response.data as any)?.found && typeof start === "number" && Number.isInteger(start) ? start : undefined;
    }).catch(() => undefined) : undefined;
    const genListBlockSubmenu = (continueListStart?: number): IMenu[] => {
        const submenu: IMenu[] = [];
        if (isOrderedList) {
            submenu.push({
                id: "orderedListStart",
                icon: "iconEdit",
                label: siyuanI18n.orderedListStart,
                click() {
                    openOrderedListStartDialog(protyle, nodeElement as HTMLElement, range);
                }
            });
            if (continueListStart !== undefined && Number.isInteger(continueListStart)) {
                submenu.push({
                    id: "continueListNumbering",
                    icon: "iconRefresh",
                    label: siyuanI18n.continueListNumbering,
                    click() {
                        setOrderedListStart(protyle, nodeElement as HTMLElement, continueListStart);
                    }
                });
            }
            submenu.push({
                id: "separator_numbering",
                type: "separator",
            });
        }
        submenu.push({
            id: "prependListItem",
            icon: "iconBefore",
            label: siyuanI18n.prependListItem,
            accelerator: getSiyuanConfig().keymap.editor.list.prependListItem.custom,
            click() {
                hideElements(["select"], protyle);
                countBlockWord([], protyle.block.rootID);
                void prependListItem(protyle, nodeElement as HTMLElement, range);
            }
        }, {
            id: "appendListItem",
            icon: "iconAfter",
            label: siyuanI18n.appendListItem,
            accelerator: getSiyuanConfig().keymap.editor.list.appendListItem.custom,
            click() {
                hideElements(["select"], protyle);
                countBlockWord([], protyle.block.rootID);
                void appendListItem(protyle, nodeElement as HTMLElement, range);
            }
        });
        return submenu;
    };
    const menu = getSiyuanGlobalMenus().menu;
    menu.append(new MenuItem({id: "separator_listBlock", type: "separator"}).element);
    menu.append(new MenuItem({
        id: "listBlock",
        icon: "iconList",
        label: siyuanI18n.listBlock,
        type: "submenu",
        submenu: genListBlockSubmenu(),
        loadSubmenu: continueListStartPromise ? async () => {
            return genListBlockSubmenu(await continueListStartPromise);
        } : undefined,
    }).element);
    return true;
}

/**
 * 构建基于节点类型的特殊菜单项
 * 根据不同的块类型添加相应的特殊操作菜单
 */
export function buildGutterTypeSpecificMenu(context: ITypeSpecificMenuContext): void {
    const { protyle, nodeElement, id, type, subType, isEmbedMenu = false } = context;

    // 使用策略模式处理不同类型
    const handlers: Record<string, () => boolean> = {
        "NodeSuperBlock": () => handleSuperBlockMenu(protyle, nodeElement),
        "NodeCodeBlock": () => handleCodeBlockMenu(protyle, nodeElement, id),
        "NodeTable": () => handleTableMenu(protyle, nodeElement),
        "NodeAttributeView": () => handleAttributeViewMenu(protyle, nodeElement, id),
        "NodeVideo": () => handleMediaMenu(protyle, nodeElement, type),
        "NodeAudio": () => handleMediaMenu(protyle, nodeElement, type),
        "NodeIFrame": () => handleMediaMenu(protyle, nodeElement, type),
        "NodeWidget": () => handleMediaMenu(protyle, nodeElement, type),
        "NodeHTMLBlock": () => handleMediaMenu(protyle, nodeElement, type),
        "NodeBlockQueryEmbed": () => handleEmbedMenu(protyle, nodeElement, id),
        "NodeHeading": () => handleHeadingMenu(protyle, nodeElement, id, subType, isEmbedMenu),
        "NodeList": () => handleListBlockMenu(protyle, nodeElement, id, type),
        "NodeListItem": () => handleListBlockMenu(protyle, nodeElement, id, type),
    };

    const handler = handlers[type];
    if (handler) {
        handler();
    }
}
