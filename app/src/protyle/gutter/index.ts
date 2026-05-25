import {
    hasClosestBlock,
    hasClosestByClassName,
    hasClosestByTag,
    hasTopClosestByClassName,
    isInAVBlock,
    isInEmbedBlock
} from "../util/hasClosest";
import {getIconByType} from "../../editor/getIcon";
import {enterBack, iframeMenu, tableMenu, videoMenu, zoomOut} from "../../menus/protyle";
import {foldBlocksRecursively, setFold} from "../util/blockFold";
import {MenuItem} from "../../menus/Menu";
import {copySubMenu, openAttr, openFileAttr, openWechatNotify} from "../../menus/commonMenuItem";
import {
    copyPlainText,
    isInAndroid,
    isInHarmony,
    isMac,
    updateHotkeyAfterTip,
} from "../util/compatibility";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { buildGutterMenu } from "./buildGutterMenu";
import { renderGutter } from "./renderGutter";
import { bindEvent, isMatchNode } from "./bindEvent";

/**
 * 思源笔记编辑器的侧边栏（Gutter）管理类
 *
 * Gutter 是位于编辑器左侧的区域，包含块操作按钮、折叠按钮等元素。
 * 它提供了对文档块的各种操作入口，如拖拽、右键菜单、折叠/展开等。
 *
 * 主要功能：
 * 1. 显示块操作按钮和图标
 * 2. 处理块的拖拽操作
 * 3. 提供右键菜单功能
 * 4. 处理块的折叠/展开
 * 5. 显示快捷键提示信息
 */
export class Gutter {
    /**
     * Gutter 的 DOM 元素，包含所有块操作按钮
     */
    public element: HTMLElement;

    /**
     * Gutter 的提示文本，包含快捷键信息
     * 根据操作系统和配置动态生成
     */
    private gutterTip: string;

    /**
     * 创建 Gutter 实例
     *
     * @param protyle 编辑器实例，包含编辑器的所有配置和状态
     */
    constructor(protyle: IProtyle) {
        // 初始化提示文本，替换默认快捷键为用户自定义快捷键
        this.gutterTip = siyuanI18n.gutterTip.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
            .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
            .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"));

        // 如果不是 Mac 系统，将 Mac 风格的快捷键符号转换为 Windows/Linux 风格
        if (!isMac()) {
            this.gutterTip = this.gutterTip.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
        }

        // 如果是反向链接模式，修改提示文本
        if (protyle.options.backlinkData) {
            this.gutterTip = this.gutterTip.replace(siyuanI18n.enter, siyuanI18n.openBy);
        }

        // 创建 Gutter 的 DOM 元素
        this.element = document.createElement("div");
        this.element.className = "protyle-gutters";

        // 绑定事件处理器
        bindEvent(protyle, this.element);
    }

    /**
     * 检查指定元素是否与当前 Gutter 匹配
     *
     * 此方法用于确定一个元素是否应该显示在当前 Gutter 位置，
     * 主要用于处理滚动和位置更新时的匹配逻辑。
     *
     * @param item 需要检查的 DOM 元素
     * @returns 如果元素匹配当前 Gutter 位置则返回 true，否则返回 false
     */
    public isMatchNode(item: Element) {
        return isMatchNode(item, this.element);
    }

    /**
     * 渲染多选块的右键菜单
     *
     * 当用户选择了多个块并右键点击时，此方法会构建并显示适用于多选场景的菜单。
     * 菜单包含批量操作选项，如批量转换、批量复制等。
     *
     * @param protyle 编辑器实例
     * @param selectsElement 被选中的元素数组
     * @returns 构建的菜单对象
     */

    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        return buildGutterMultipleMenu({ protyle, selectsElement });
    }

    /**
     * 渲染单个块的右键菜单
     *
     * 当用户右键点击单个块的 Gutter 按钮时，此方法会构建并显示适用于单个块的菜单。
     * 菜单包含块的各种操作选项，如转换类型、复制、编辑等。
     *
     * @param protyle 编辑器实例
     * @param buttonElement 被点击的按钮元素
     * @returns 构建的菜单对象
     */

    // S-forge: 开始 - 代码重构：将菜单构建逻辑拆分到独立模块以提高可维护性
    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        return buildGutterMenu({ protyle, buttonElement });
        if (!buttonElement) {
            return;
        }
        hideElements(["util", "toolbar", "hint"], protyle);
        window.siyuan.menus.menu.remove();
        if (isMobile()) {
            activeBlur();
        }
        const id = buttonElement.getAttribute("data-node-id");
        const selectsElement = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectsElement.length > 1) {
            window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BLOCK_MULTI);
            const match = Array.from(selectsElement).find(item => {
                if (id === item.getAttribute("data-node-id")) {
                    return true;
                }
            });
            if (match) {
                return this.renderMultipleMenu(protyle, Array.from(selectsElement));
            }
        } else {
            window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_BLOCK_SINGLE);
        }

        let nodeElement: Element;
        if (buttonElement.tagName === "BUTTON") {
            Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${id}"]`)).find(item => {
                if (!isInEmbedBlock(item) && this.isMatchNode(item)) {
                    nodeElement = item;
                    return true;
                }
            });
        } else {
            nodeElement = buttonElement;
        }
        if (!nodeElement) {
            return;
        }
        const type = nodeElement.getAttribute("data-type");
        const subType = nodeElement.getAttribute("data-subtype");
        const turnIntoSubmenu: IMenu[] = [];
        hideElements(["select"], protyle);
        nodeElement.classList.add("protyle-wysiwyg--select");
        countBlockWord([id], protyle.block.rootID);
        // "heading1-6", "list", "ordered-list", "check", "quote", "code", "table", "line", "math", "paragraph"
        if (type === "NodeParagraph" && !protyle.disabled) {
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "list",
                icon: "iconList",
                label: window.siyuan.languages.list,
                accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2ULs"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "orderedList",
                icon: "iconOrderedList",
                label: window.siyuan.languages["ordered-list"],
                accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2OLs"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "check",
                icon: "iconCheck",
                label: window.siyuan.languages.check,
                accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2TLs"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "quote",
                icon: "iconQuote",
                label: window.siyuan.languages.quote,
                accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Blockquote"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "callout",
                icon: "iconCallout",
                label: window.siyuan.languages.callout,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Callout"
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading1",
                icon: "iconH1",
                label: window.siyuan.languages.heading1,
                accelerator: window.siyuan.config.keymap.editor.heading.heading1.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 1,
                type: "Blocks2Hs",
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading2",
                icon: "iconH2",
                label: window.siyuan.languages.heading2,
                accelerator: window.siyuan.config.keymap.editor.heading.heading2.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 2,
                type: "Blocks2Hs",
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading3",
                icon: "iconH3",
                label: window.siyuan.languages.heading3,
                accelerator: window.siyuan.config.keymap.editor.heading.heading3.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 3,
                type: "Blocks2Hs",
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading4",
                icon: "iconH4",
                label: window.siyuan.languages.heading4,
                accelerator: window.siyuan.config.keymap.editor.heading.heading4.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 4,
                type: "Blocks2Hs",
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading5",
                icon: "iconH5",
                label: window.siyuan.languages.heading5,
                accelerator: window.siyuan.config.keymap.editor.heading.heading5.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 5,
                type: "Blocks2Hs",
            }));
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "heading6",
                icon: "iconH6",
                label: window.siyuan.languages.heading6,
                accelerator: window.siyuan.config.keymap.editor.heading.heading6.custom,
                protyle,
                selectsElement: [nodeElement],
                level: 6,
                type: "Blocks2Hs",
            }));
        } else if (type === "NodeHeading" && !protyle.disabled) {
            turnIntoSubmenu.push(this.turnsInto({
                menuId: "paragraph",
                icon: "iconParagraph",
                label: window.siyuan.languages.paragraph,
                accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Ps",
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "quote",
                icon: "iconQuote",
                label: window.siyuan.languages.quote,
                accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Blockquote"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "callout",
                icon: "iconCallout",
                label: window.siyuan.languages.callout,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Callout"
            }));
            if (subType !== "h1") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading1",
                    icon: "iconH1",
                    label: window.siyuan.languages.heading1,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading1.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 1,
                    type: "Blocks2Hs",
                }));
            }
            if (subType !== "h2") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading2",
                    icon: "iconH2",
                    label: window.siyuan.languages.heading2,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading2.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 2,
                    type: "Blocks2Hs",
                }));
            }
            if (subType !== "h3") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading3",
                    icon: "iconH3",
                    label: window.siyuan.languages.heading3,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading3.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 3,
                    type: "Blocks2Hs",
                }));
            }
            if (subType !== "h4") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading4",
                    icon: "iconH4",
                    label: window.siyuan.languages.heading4,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading4.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 4,
                    type: "Blocks2Hs",
                }));
            }
            if (subType !== "h5") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading5",
                    icon: "iconH5",
                    label: window.siyuan.languages.heading5,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading5.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 5,
                    type: "Blocks2Hs",
                }));
            }
            if (subType !== "h6") {
                turnIntoSubmenu.push(this.turnsInto({
                    menuId: "heading6",
                    icon: "iconH6",
                    label: window.siyuan.languages.heading6,
                    accelerator: window.siyuan.config.keymap.editor.heading.heading6.custom,
                    protyle,
                    selectsElement: [nodeElement],
                    level: 6,
                    type: "Blocks2Hs",
                }));
            }
        } else if (type === "NodeList" && !protyle.disabled) {
            turnIntoSubmenu.push(this.turnsOneInto({
                menuId: "paragraph",
                id,
                icon: "iconParagraph",
                label: window.siyuan.languages.paragraph,
                accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
                protyle,
                nodeElement,
                type: "CancelList"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "quote",
                icon: "iconQuote",
                label: window.siyuan.languages.quote,
                accelerator: window.siyuan.config.keymap.editor.insert.quote.custom,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Blockquote"
            }));
            turnIntoSubmenu.push(this.turnsIntoOne({
                menuId: "callout",
                icon: "iconCallout",
                label: window.siyuan.languages.callout,
                protyle,
                selectsElement: [nodeElement],
                type: "Blocks2Callout"
            }));
            if (nodeElement.getAttribute("data-subtype") === "o") {
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "list",
                    id,
                    icon: "iconList",
                    label: window.siyuan.languages.list,
                    accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
                    protyle,
                    nodeElement,
                    type: "OL2UL"
                }));
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "check",
                    id,
                    icon: "iconCheck",
                    label: window.siyuan.languages.check,
                    accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
                    protyle,
                    nodeElement,
                    type: "UL2TL"
                }));
            } else if (nodeElement.getAttribute("data-subtype") === "t") {
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "list",
                    id,
                    icon: "iconList",
                    label: window.siyuan.languages.list,
                    accelerator: window.siyuan.config.keymap.editor.insert.list.custom,
                    protyle,
                    nodeElement,
                    type: "TL2UL"
                }));
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "orderedList",
                    id,
                    icon: "iconOrderedList",
                    label: window.siyuan.languages["ordered-list"],
                    accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
                    protyle,
                    nodeElement,
                    type: "TL2OL"
                }));
            } else {
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "orderedList",
                    id,
                    icon: "iconOrderedList",
                    label: window.siyuan.languages["ordered-list"],
                    accelerator: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
                    protyle,
                    nodeElement,
                    type: "UL2OL"
                }));
                turnIntoSubmenu.push(this.turnsOneInto({
                    menuId: "check",
                    id,
                    icon: "iconCheck",
                    label: window.siyuan.languages.check,
                    accelerator: window.siyuan.config.keymap.editor.insert.check.custom,
                    protyle,
                    nodeElement,
                    type: "OL2TL"
                }));
            }
        } else if (type === "NodeBlockquote" && !protyle.disabled) {
            turnIntoSubmenu.push(this.turnsOneInto({
                menuId: "paragraph",
                id,
                icon: "iconParagraph",
                label: window.siyuan.languages.paragraph,
                accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
                protyle,
                nodeElement,
                type: "CancelBlockquote"
            }));
            turnIntoSubmenu.push(this.turnsOneInto({
                id,
                icon: "iconCallout",
                label: window.siyuan.languages.callout,
                protyle,
                nodeElement,
                type: "Blockquote2Callout"
            }));
        } else if (type === "NodeCallout" && !protyle.disabled) {
            turnIntoSubmenu.push(this.turnsOneInto({
                menuId: "paragraph",
                id,
                icon: "iconParagraph",
                label: window.siyuan.languages.paragraph,
                accelerator: window.siyuan.config.keymap.editor.heading.paragraph.custom,
                protyle,
                nodeElement,
                type: "CancelCallout"
            }));
            turnIntoSubmenu.push(this.turnsOneInto({
                id,
                icon: "iconQuote",
                label: window.siyuan.languages.quote,
                protyle,
                nodeElement,
                type: "Callout2Blockquote"
            }));
        }
        if (turnIntoSubmenu.length > 0 && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "turnInto",
                icon: "iconTurnInto",
                label: window.siyuan.languages.turnInto,
                type: "submenu",
                submenu: turnIntoSubmenu
            }).element);
        }
        if (!protyle.disabled && !nodeElement.classList.contains("hr")) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "ai",
                icon: "iconSparkles",
                label: window.siyuan.languages.ai,
                accelerator: window.siyuan.config.keymap.editor.general.ai.custom,
                click() {
                    AIActions([nodeElement], protyle);
                }
            }).element);
        }

        const copyMenu = (copySubMenu([id], true, nodeElement) as IMenu[]).concat([{
            id: "copyPlainText",
            iconHTML: "",
            label: window.siyuan.languages.copyPlainText,
            accelerator: window.siyuan.config.keymap.editor.general.copyPlainText.custom,
            click() {
                copyPlainText(getPlainText(nodeElement as HTMLElement).trimEnd());
                focusBlock(nodeElement);
            }
        }, {
            id: type === "NodeAttributeView" ? "copyMirror" : "copy",
            iconHTML: "",
            label: type === "NodeAttributeView" ? window.siyuan.languages.copyMirror : window.siyuan.languages.copy,
            accelerator: "⌘C",
            click() {
                if (isNotEditBlock(nodeElement)) {
                    focusBlock(nodeElement);
                } else {
                    focusByRange(getEditorRange(nodeElement));
                }
                document.execCommand("copy");
            }
        }]);
        const copyTextRefMenu = this.genCopyTextRef([nodeElement]);
        if (copyTextRefMenu) {
            copyMenu.splice(7, 0, copyTextRefMenu);
        }
        if (type === "NodeAttributeView") {
            copyMenu.splice(6, 0, {
                iconHTML: "",
                label: window.siyuan.languages.copyAVID,
                click() {
                    writeText(nodeElement.getAttribute("data-av-id"));
                }
            });
            if (!protyle.disabled) {
                copyMenu.push({
                    id: "duplicateMirror",
                    iconHTML: "",
                    label: window.siyuan.languages.duplicateMirror,
                    accelerator: window.siyuan.config.keymap.editor.general.duplicate.custom,
                    click() {
                        duplicateBlock([nodeElement], protyle);
                    }
                });
                copyMenu.push({
                    id: "duplicateCompletely",
                    iconHTML: "",
                    label: window.siyuan.languages.duplicateCompletely,
                    accelerator: window.siyuan.config.keymap.editor.general.duplicateCompletely.custom,
                    click() {
                        duplicateCompletely(protyle, nodeElement as HTMLElement);
                    }
                });
            }
        } else if (!protyle.disabled) {
            copyMenu.push({
                id: "duplicate",
                iconHTML: "",
                label: window.siyuan.languages.duplicate,
                accelerator: window.siyuan.config.keymap.editor.general.duplicate.custom,
                click() {
                    duplicateBlock([nodeElement], protyle);
                }
            });
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "copy",
            icon: "iconCopy",
            label: window.siyuan.languages.copy,
            type: "submenu",
            submenu: copyMenu
        }).element);
        if (!protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "cut",
                icon: "iconCut",
                label: window.siyuan.languages.cut,
                accelerator: "⌘X",
                click: () => {
                    focusBlock(nodeElement);
                    document.execCommand("cut");
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "move",
                icon: "iconMove",
                label: window.siyuan.languages.move,
                accelerator: window.siyuan.config.keymap.general.move.custom,
                click: () => {
                    movePathTo({
                        cb: (toPath) => {
                            hintMoveBlock(toPath[0], [nodeElement], protyle);
                        },
                        flashcard: false,
                    });
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "addToDatabase",
                icon: "iconDatabase",
                label: window.siyuan.languages.addToDatabase,
                accelerator: window.siyuan.config.keymap.general.addToDatabase.custom,
                click: () => {
                    addEditorToDatabase(protyle, getEditorRange(nodeElement));
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "delete",
                icon: "iconTrashcan",
                label: window.siyuan.languages.delete,
                accelerator: "⌫",
                click: () => {
                    protyle.breadcrumb?.hide();
                    removeBlock(protyle, nodeElement, getEditorRange(nodeElement), "Backspace");
                }
            }).element);
        }
        if (type === "NodeSuperBlock" && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "separator_cancelSuperBlock",
                type: "separator"
            }).element);
            const isCol = nodeElement.getAttribute("data-sb-layout") === "col";
            window.siyuan.menus.menu.append(new MenuItem({
                id: "cancelSuperBlock",
                label: window.siyuan.languages.cancel + " " + window.siyuan.languages.superBlock,
                accelerator: window.siyuan.config.keymap.editor.general[isCol ? "hLayout" : "vLayout"].custom,
                async click() {
                    const sbData = await cancelSB(protyle, nodeElement);
                    transaction(protyle, sbData.doOperations, sbData.undoOperations);
                    focusBlock(protyle.wysiwyg.element.querySelector(`[data-node-id="${sbData.previousId}"]`));
                    hideElements(["gutter"], protyle);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "turnInto" + (isCol ? "VLayout" : "HLayout"),
                accelerator: window.siyuan.config.keymap.editor.general[isCol ? "vLayout" : "hLayout"].custom,
                label: window.siyuan.languages.turnInto + " " + window.siyuan.languages[isCol ? "vLayout" : "hLayout"],
                click() {
                    const oldHTML = nodeElement.outerHTML;
                    if (isCol) {
                        nodeElement.setAttribute("data-sb-layout", "row");
                    } else {
                        nodeElement.setAttribute("data-sb-layout", "col");
                    }
                    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                    updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                    focusByRange(protyle.toolbar.range);
                    hideElements(["gutter"], protyle);
                }
            }).element);
        } else if (type === "NodeCodeBlock" && !nodeElement.getAttribute("data-subtype")) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_code", type: "separator"}).element);
            const linewrap = nodeElement.getAttribute("linewrap");
            const ligatures = nodeElement.getAttribute("ligatures");
            const linenumber = nodeElement.getAttribute("linenumber");

            window.siyuan.menus.menu.append(new MenuItem({
                id: "code",
                type: "submenu",
                icon: "iconCode",
                label: window.siyuan.languages.code,
                submenu: [{
                    id: "md31",
                    iconHTML: "",
                    ignore: protyle.disabled,
                    label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${window.siyuan.languages.md31}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${linewrap === "true" ? " checked" : ((window.siyuan.config.editor.codeLineWrap && linewrap !== "false") ? " checked" : "")}></div>`,
                    bind(element) {
                        element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
                            const inputElement = element.querySelector("input");
                            if (event.target.tagName !== "INPUT") {
                                inputElement.checked = !inputElement.checked;
                            }
                            nodeElement.setAttribute("linewrap", inputElement.checked.toString());
                            nodeElement.querySelector(".hljs").removeAttribute("data-render");
                            highlightRender(nodeElement);
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {linewrap: inputElement.checked.toString()}
                            });
                            window.siyuan.menus.menu.remove();
                        });
                    }
                }, {
                    id: "md2",
                    iconHTML: "",
                    ignore: protyle.disabled,
                    label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${window.siyuan.languages.md2}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${ligatures === "true" ? " checked" : ((window.siyuan.config.editor.codeLigatures && ligatures !== "false") ? " checked" : "")}></div>`,
                    bind(element) {
                        element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
                            const inputElement = element.querySelector("input");
                            if (event.target.tagName !== "INPUT") {
                                inputElement.checked = !inputElement.checked;
                            }
                            nodeElement.setAttribute("ligatures", inputElement.checked.toString());
                            nodeElement.querySelector(".hljs").removeAttribute("data-render");
                            highlightRender(nodeElement);
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {ligatures: inputElement.checked.toString()}
                            });
                            window.siyuan.menus.menu.remove();
                        });
                    }
                }, {
                    id: "md27",
                    iconHTML: "",
                    ignore: protyle.disabled,
                    label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${window.siyuan.languages.md27}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${linenumber === "true" ? " checked" : ((window.siyuan.config.editor.codeSyntaxHighlightLineNum && linenumber !== "false") ? " checked" : "")}></div>`,
                    bind(element) {
                        element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
                            const inputElement = element.querySelector("input");
                            if (event.target.tagName !== "INPUT") {
                                inputElement.checked = !inputElement.checked;
                            }
                            nodeElement.setAttribute("linenumber", inputElement.checked.toString());
                            nodeElement.querySelector(".hljs").removeAttribute("data-render");
                            highlightRender(nodeElement);
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {linenumber: inputElement.checked.toString()}
                            });
                            window.siyuan.menus.menu.remove();
                        });
                    }
                }, {
                    id: "saveCodeBlockAsFile",
                    iconHTML: "",
                    label: window.siyuan.languages.saveCodeBlockAsFile,
                    click() {
                        const msgId = showMessage(window.siyuan.languages.exporting, -1);
                        fetchPost("/api/export/exportCodeBlock", {id}, (response) => {
                            hideMessage(msgId);
                            saveExportFile(response.data.path);
                        });
                    }
                }]
            }).element);
        } else if (type === "NodeCodeBlock" && !protyle.disabled && ["echarts", "mindmap"].includes(nodeElement.getAttribute("data-subtype"))) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_chart", type: "separator"}).element);
            const height = (nodeElement as HTMLElement).style.height;
            let html = nodeElement.outerHTML;
            window.siyuan.menus.menu.append(new MenuItem({
                id: "chart",
                label: window.siyuan.languages.chart,
                icon: "iconCode",
                submenu: [{
                    id: "height",
                    iconHTML: "",
                    type: "readonly",
                    label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${height ? parseInt(height) : "420"}" step="1" min="148" style="margin: 4px 8px 4px 0" placeholder="${window.siyuan.languages.height}"><span class="fn__flex-center">px</span></div>`,
                    bind: (element) => {
                        element.querySelector("input").addEventListener("change", (event) => {
                            const newHeight = ((event.target as HTMLInputElement).value || "420") + "px";
                            (nodeElement as HTMLElement).style.height = newHeight;
                            updateTransaction(protyle, id, nodeElement.outerHTML, html);
                            html = nodeElement.outerHTML;
                            event.stopPropagation();
                            const renderElement = nodeElement.querySelector('[contenteditable="false"]') as HTMLElement;
                            if (renderElement) {
                                renderElement.style.height = newHeight;
                                const chartInstance = window.echarts.getInstanceById(renderElement.getAttribute("_echarts_instance_"));
                                if (chartInstance) {
                                    chartInstance.resize();
                                }
                            }
                        });
                    }
                }, {
                    id: "update",
                    label: window.siyuan.languages.update,
                    icon: "iconEdit",
                    click() {
                        protyle.toolbar.showRender(protyle, nodeElement);
                    }
                }]
            }).element);
        } else if (type === "NodeTable" && !protyle.disabled) {
            let range = getEditorRange(nodeElement);
            const tableElement = nodeElement.querySelector("table");
            if (!tableElement.contains(range.startContainer)) {
                range = getEditorRange(tableElement.querySelector("th"));
            }
            const cellElement = hasClosestByTag(range.startContainer, "TD") ||
                hasClosestByTag(range.startContainer, "TH") || nodeElement.querySelector("th, td");
            if (cellElement) {
                window.siyuan.menus.menu.append(new MenuItem({id: "separator_table", type: "separator"}).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "table",
                    type: "submenu",
                    icon: "iconTable",
                    label: window.siyuan.languages.table,
                    submenu: tableMenu(protyle, nodeElement, cellElement as HTMLTableCellElement, range).menus as IMenu[]
                }).element);
            }
        } else if (type === "NodeAttributeView") {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_exportCSV", type: "separator"}).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "exportCSV",
                icon: "iconDatabase",
                label: window.siyuan.languages.export + " CSV",
                click() {
                    fetchPost("/api/export/exportAttributeView", {
                        id: nodeElement.getAttribute("data-av-id"),
                        blockID: id,
                    }, response => {
                        saveExportFile(response.data.zip);
                    });
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "showDatabaseInFolder",
                icon: "iconFolder",
                label: window.siyuan.languages.showInFolder,
                click() {
                    useShell("showItemInFolder", path.join(window.siyuan.config.system.dataDir, "storage", "av", nodeElement.getAttribute("data-av-id")) + ".json");
                }
            }).element);
        } else if ((type === "NodeVideo" || type === "NodeAudio") && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_VideoOrAudio", type: "separator"}).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: type === "NodeVideo" ? "assetVideo" : "assetAudio",
                type: "submenu",
                icon: type === "NodeVideo" ? "iconVideo" : "iconRecord",
                label: window.siyuan.languages.assets,
                submenu: videoMenu(protyle, nodeElement, type)
            }).element);
        } else if (type === "NodeIFrame" && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_IFrame", type: "separator"}).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "assetIFrame",
                type: "submenu",
                icon: "iconGlobe",
                label: window.siyuan.languages.assets,
                submenu: iframeMenu(protyle, nodeElement)
            }).element);
        } else if (type === "NodeHTMLBlock" && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_html", type: "separator"}).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "html",
                icon: "iconHTML5",
                label: "HTML",
                click() {
                    protyle.toolbar.showRender(protyle, nodeElement);
                }
            }).element);
        } else if (type === "NodeBlockQueryEmbed" && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_blockEmbed", type: "separator"}).element);
            const breadcrumb = nodeElement.getAttribute("breadcrumb");
            window.siyuan.menus.menu.append(new MenuItem({
                id: "blockEmbed",
                type: "submenu",
                icon: "iconSQL",
                label: window.siyuan.languages.blockEmbed,
                submenu: [{
                    id: "refresh",
                    icon: "iconRefresh",
                    label: `${window.siyuan.languages.refresh} SQL`,
                    click() {
                        nodeElement.removeAttribute("data-render");
                        blockRender(protyle, nodeElement);
                    }
                }, {
                    id: "update",
                    icon: "iconEdit",
                    label: `${window.siyuan.languages.update} SQL`,
                    click() {
                        protyle.toolbar.showRender(protyle, nodeElement);
                    }
                }, {
                    type: "separator"
                }, {
                    id: "embedBlockBreadcrumb",
                    label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${window.siyuan.languages.embedBlockBreadcrumb}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${breadcrumb === "true" ? " checked" : ((window.siyuan.config.editor.embedBlockBreadcrumb && breadcrumb !== "false") ? " checked" : "")}></div>`,
                    bind(element) {
                        element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
                            const inputElement = element.querySelector("input");
                            if (event.target.tagName !== "INPUT") {
                                inputElement.checked = !inputElement.checked;
                            }
                            nodeElement.setAttribute("breadcrumb", inputElement.checked.toString());
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {breadcrumb: inputElement.checked.toString()}
                            });
                            nodeElement.removeAttribute("data-render");
                            blockRender(protyle, nodeElement);
                            window.siyuan.menus.menu.remove();
                        });
                    }
                }, {
                    id: "headingEmbedMode",
                    label: window.siyuan.languages.headingEmbedMode,
                    type: "submenu",
                    submenu: [{
                        id: "showHeadingWithBlocks",
                        label: window.siyuan.languages.showHeadingWithBlocks,
                        iconHTML: "",
                        checked: nodeElement.getAttribute("custom-heading-mode") === "0",
                        click() {
                            nodeElement.setAttribute("custom-heading-mode", "0");
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {"custom-heading-mode": "0"}
                            });
                            nodeElement.removeAttribute("data-render");
                            blockRender(protyle, nodeElement);
                        }
                    }, {
                        id: "showHeadingOnlyTitle",
                        label: window.siyuan.languages.showHeadingOnlyTitle,
                        iconHTML: "",
                        checked: nodeElement.getAttribute("custom-heading-mode") === "1",
                        click() {
                            nodeElement.setAttribute("custom-heading-mode", "1");
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {"custom-heading-mode": "1"}
                            });
                            nodeElement.removeAttribute("data-render");
                            blockRender(protyle, nodeElement);
                        }
                    }, {
                        id: "showHeadingOnlyBlocks",
                        label: window.siyuan.languages.showHeadingOnlyBlocks,
                        iconHTML: "",
                        checked: nodeElement.getAttribute("custom-heading-mode") === "2",
                        click() {
                            nodeElement.setAttribute("custom-heading-mode", "2");
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {"custom-heading-mode": "2"}
                            });
                            nodeElement.removeAttribute("data-render");
                            blockRender(protyle, nodeElement);
                        }
                    }, {
                        id: "default",
                        label: window.siyuan.languages.default,
                        iconHTML: "",
                        checked: !nodeElement.getAttribute("custom-heading-mode"),
                        click() {
                            nodeElement.removeAttribute("custom-heading-mode");
                            fetchPost("/api/attr/setBlockAttrs", {
                                id,
                                attrs: {"custom-heading-mode": ""}
                            });
                            nodeElement.removeAttribute("data-render");
                            blockRender(protyle, nodeElement);
                        }
                    }]
                }]
            }).element);
        } else if (type === "NodeHeading" && !protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_1", type: "separator"}).element);
            const headingSubMenu = [];
            if (subType !== "h1") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 1));
            }
            if (subType !== "h2") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 2));
            }
            if (subType !== "h3") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 3));
            }
            if (subType !== "h4") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 4));
            }
            if (subType !== "h5") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 5));
            }
            if (subType !== "h6") {
                headingSubMenu.push(this.genHeadingTransform(protyle, id, 6));
            }
            window.siyuan.menus.menu.append(new MenuItem({
                id: "tWithSubtitle",
                type: "submenu",
                icon: "iconRefresh",
                label: window.siyuan.languages.tWithSubtitle,
                submenu: headingSubMenu
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "copyHeadings1",
                icon: "iconCopy",
                label: `${window.siyuan.languages.copy} ${window.siyuan.languages.headings1}`,
                click() {
                    fetchPost("/api/block/getHeadingChildrenDOM", {
                        id,
                        removeFoldAttr: nodeElement.getAttribute("fold") !== "1"
                    }, (response) => {
                        if (isInAndroid()) {
                            window.JSAndroid.writeSiYuanHTMLClipboard(protyle.lute.BlockDOM2StdMd(response.data).trimEnd(), protyle.lute.BlockDOM2HTML(response.data).trimEnd(), response.data + Constants.ZWSP);
                        } else if (isInHarmony()) {
                            window.JSHarmony.writeSiYuanHTMLClipboard(protyle.lute.BlockDOM2StdMd(response.data).trimEnd(), protyle.lute.BlockDOM2HTML(response.data).trimEnd(), response.data + Constants.ZWSP);
                        } else {
                            writeText(response.data + Constants.ZWSP);
                        }
                    });
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "cutHeadings1",
                icon: "iconCut",
                label: `${window.siyuan.languages.cut} ${window.siyuan.languages.headings1}`,
                click() {
                    fetchPost("/api/block/getHeadingChildrenDOM", {
                        id,
                        removeFoldAttr: nodeElement.getAttribute("fold") !== "1"
                    }, (response) => {
                        if (isInAndroid()) {
                            window.JSAndroid.writeHTMLClipboard(protyle.lute.BlockDOM2StdMd(response.data).trimEnd(), response.data + Constants.ZWSP);
                        } else if (isInHarmony()) {
                            window.JSHarmony.writeHTMLClipboard(protyle.lute.BlockDOM2StdMd(response.data).trimEnd(), response.data + Constants.ZWSP);
                        } else {
                            writeText(response.data + Constants.ZWSP);
                        }
                        fetchPost("/api/block/getHeadingDeleteTransaction", {
                            id,
                        }, (deleteResponse) => {
                            deleteResponse.data.doOperations.forEach((operation: IOperation) => {
                                protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                                    itemElement.remove();
                                });
                            });
                            if (protyle.wysiwyg.element.childElementCount === 0) {
                                const newID = Lute.NewNodeID();
                                const emptyElement = genEmptyElement(false, false, newID);
                                protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyElement);
                                deleteResponse.data.doOperations.push({
                                    action: "insert",
                                    data: emptyElement.outerHTML,
                                    id: newID,
                                    parentID: protyle.block.parentID
                                });
                                deleteResponse.data.undoOperations.push({
                                    action: "delete",
                                    id: newID,
                                });
                                focusBlock(emptyElement);
                            }
                            transaction(protyle, deleteResponse.data.doOperations, deleteResponse.data.undoOperations);
                        });
                    });
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "deleteHeadings1",
                icon: "iconTrashcan",
                label: `${window.siyuan.languages.delete} ${window.siyuan.languages.headings1}`,
                click() {
                    fetchPost("/api/block/getHeadingDeleteTransaction", {
                        id,
                    }, (response) => {
                        response.data.doOperations.forEach((operation: IOperation) => {
                            protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                                itemElement.remove();
                            });
                        });
                        if (protyle.wysiwyg.element.childElementCount === 0) {
                            const newID = Lute.NewNodeID();
                            const emptyElement = genEmptyElement(false, false, newID);
                            protyle.wysiwyg.element.insertAdjacentElement("afterbegin", emptyElement);
                            response.data.doOperations.push({
                                action: "insert",
                                data: emptyElement.outerHTML,
                                id: newID,
                                parentID: protyle.block.parentID
                            });
                            response.data.undoOperations.push({
                                action: "delete",
                                id: newID,
                            });
                            focusBlock(emptyElement);
                        }
                        transaction(protyle, response.data.doOperations, response.data.undoOperations);
                    });
                }
            }).element);
        }
        window.siyuan.menus.menu.append(new MenuItem({id: "separator_2", type: "separator"}).element);
        if (!protyle.options.backlinkData) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "enter",
                icon: "iconEnter",
                accelerator: `${window.siyuan.config.keymap.general.enter.custom ? updateHotkeyTip(window.siyuan.config.keymap.general.enter.custom) + "/" : ""}${updateHotkeyAfterTip("⌘" + window.siyuan.languages.click)}`,
                label: window.siyuan.languages.enter,
                click: () => {
                    zoomOut({protyle, id});
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "enterBack",
                icon: "iconEnterBack",
                accelerator: window.siyuan.config.keymap.general.enterBack.custom,
                label: window.siyuan.languages.enterBack,
                click: () => {
                    enterBack(protyle, id);
                }
            }).element);
        } else {
            /// #if !MOBILE
            window.siyuan.menus.menu.append(new MenuItem({
                id: "enter",
                icon: "iconEnter",
                accelerator: `${updateHotkeyTip(window.siyuan.config.keymap.general.enter.custom)}/${updateHotkeyTip("⌘" + window.siyuan.languages.click)}`,
                label: window.siyuan.languages.openBy,
                click: () => {
                    checkFold(id, (zoomIn, action) => {
                        openFileById({
                            app: protyle.app,
                            id,
                            action,
                            zoomIn
                        });
                    });
                }
            }).element);
            /// #endif
        }
        if (!protyle.disabled) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "insertBefore",
                icon: "iconBefore",
                label: window.siyuan.languages.insertBefore,
                accelerator: window.siyuan.config.keymap.editor.general.insertBefore.custom,
                click() {
                    hideElements(["select"], protyle);
                    countBlockWord([], protyle.block.rootID);
                    insertEmptyBlock(protyle, "beforebegin", id);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "insertAfter",
                icon: "iconAfter",
                label: window.siyuan.languages.insertAfter,
                accelerator: window.siyuan.config.keymap.editor.general.insertAfter.custom,
                click() {
                    hideElements(["select"], protyle);
                    countBlockWord([], protyle.block.rootID);
                    insertEmptyBlock(protyle, "afterend", id);
                }
            }).element);
            const countElement = nodeElement.lastElementChild.querySelector(".protyle-attr--refcount");
            if (countElement && countElement.textContent) {
                transferBlockRef(id);
            }
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "jumpTo",
            icon: "iconJumpTo",
            type: "submenu",
            label: window.siyuan.languages.jumpTo,
            submenu: [{
                id: "jumpToParentPrev",
                iconHTML: "",
                label: window.siyuan.languages.jumpToParentPrev,
                accelerator: window.siyuan.config.keymap.editor.general.jumpToParentPrev.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "previous");
                }
            }, {
                iconHTML: "",
                id: "jumpToParentNext",
                label: window.siyuan.languages.jumpToParentNext,
                accelerator: window.siyuan.config.keymap.editor.general.jumpToParentNext.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "next");
                }
            }, {
                iconHTML: "",
                id: "jumpToParent",
                label: window.siyuan.languages.jumpToParent,
                accelerator: window.siyuan.config.keymap.editor.general.jumpToParent.custom,
                click() {
                    hideElements(["select"], protyle);
                    jumpToParent(protyle, nodeElement, "parent");
                }
            }]
        }).element);

        window.siyuan.menus.menu.append(new MenuItem({id: "separator_3", type: "separator"}).element);

        if (type !== "NodeThematicBreak") {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "fold",
                icon: "iconFoldUnFold",
                label: window.siyuan.languages.fold,
                accelerator: `${updateHotkeyTip(window.siyuan.config.keymap.editor.general.collapse.custom)}/${updateHotkeyTip("⌥" + window.siyuan.languages.click)}`,
                click() {
                    setFold(protyle, nodeElement);
                    focusBlock(nodeElement);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "foldRecursive",
                icon: "iconFoldUnFold",
                label: window.siyuan.languages.foldRecursive,
                accelerator: window.siyuan.config.keymap.editor.general.foldRecursive?.custom,
                click() {
                    foldBlocksRecursively(protyle, [nodeElement]);
                    focusBlock(nodeElement);
                }
            }).element);
            if (!protyle.disabled) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "attr",
                    label: window.siyuan.languages.attr,
                    icon: "iconAttr",
                    accelerator: window.siyuan.config.keymap.editor.general.attr.custom + "/" + updateHotkeyTip("⇧" + window.siyuan.languages.click),
                    click() {
                        openAttr(nodeElement, "bookmark", protyle);
                    }
                }).element);
            }
        }
        if (!protyle.disabled) {
            const appearanceElement = new MenuItem({
                id: "appearance",
                label: window.siyuan.languages.appearance,
                icon: "iconFont",
                accelerator: window.siyuan.config.keymap.editor.insert.appearance.custom,
                click: () => {
                    /// #if MOBILE
                    this.showMobileAppearance(protyle);
                    /// #else
                    protyle.toolbar.element.classList.add("fn__none");
                    protyle.toolbar.subElement.innerHTML = "";
                    protyle.toolbar.subElement.style.width = "";
                    protyle.toolbar.subElement.style.padding = "";
                    protyle.toolbar.subElement.append(appearanceMenu(protyle, [nodeElement]));
                    protyle.toolbar.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
                    protyle.toolbar.subElement.classList.remove("fn__none");
                    protyle.toolbar.subElementCloseCB = undefined;
                    const position = nodeElement.getBoundingClientRect();
                    setPosition(protyle.toolbar.subElement, position.left, position.top);
                    /// #endif
                }
            }).element;
            window.siyuan.menus.menu.append(appearanceElement);
            if (!isMobile()) {
                appearanceElement.lastElementChild.classList.add("b3-menu__submenu--row");
            }
            this.genAlign([nodeElement], protyle);
            this.genWidths([nodeElement], protyle);
            // this.genHeights([nodeElement], protyle);
        }
        window.siyuan.menus.menu.append(new MenuItem({id: "separator_4", type: "separator"}).element);
        if (window.siyuan.config.cloudRegion === 0 &&
            !["NodeThematicBreak", "NodeBlockQueryEmbed", "NodeIFrame", "NodeHTMLBlock", "NodeWidget", "NodeVideo", "NodeAudio"].includes(type) &&
            getContenteditableElement(nodeElement)?.textContent.trim() !== "" &&
            (type !== "NodeCodeBlock" || (type === "NodeCodeBlock" && !nodeElement.getAttribute("data-subtype")))) {
            window.siyuan.menus.menu.append(new MenuItem({
                id: "wechatReminder",
                icon: "iconMp",
                label: window.siyuan.languages.wechatReminder,
                ignore: window.siyuan.config.readonly,
                click() {
                    openWechatNotify(nodeElement);
                }
            }).element);
        }
        if (type !== "NodeThematicBreak" && !window.siyuan.config.readonly) {
            const isCardMade = nodeElement.hasAttribute(Constants.CUSTOM_RIFF_DECKS);
            window.siyuan.menus.menu.append(new MenuItem({
                id: isCardMade ? "removeCard" : "quickMakeCard",
                icon: "iconRiffCard",
                label: isCardMade ? window.siyuan.languages.removeCard : window.siyuan.languages.quickMakeCard,
                accelerator: window.siyuan.config.keymap.editor.general.quickMakeCard.custom,
                click() {
                    quickMakeCard(protyle, [nodeElement]);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "addToDeck",
                label: window.siyuan.languages.addToDeck,
                ignore: !window.siyuan.config.flashcard.deck,
                icon: "iconRiffCard",
                click() {
                    makeCard(protyle.app, [id]);
                }
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({id: "separator_5", type: "separator"}).element);
        }

        if (protyle?.app?.plugins) {
            emitOpenMenu({
                plugins: protyle.app.plugins,
                type: "click-blockicon",
                detail: {
                    protyle,
                    blockElements: [nodeElement]
                },
                separatorPosition: "bottom",
            });
        }

        let updateHTML = nodeElement.getAttribute("updated") || "";
        if (updateHTML) {
            updateHTML = `${window.siyuan.languages.modifiedAt} ${dayjs(updateHTML).format("YYYY-MM-DD HH:mm:ss")}<br>`;
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "updateAndCreatedAt",
            iconHTML: "",
            type: "readonly",
            label: `${updateHTML}${window.siyuan.languages.createdAt} ${dayjs(id.substr(0, 14)).format("YYYY-MM-DD HH:mm:ss")}`,
        }).element);
        return window.siyuan.menus.menu;
    }

    private genHeadingTransform(protyle: IProtyle, id: string, level: number) {
        return {
            id: "heading" + level,
            iconHTML: "",
            icon: "iconHeading" + level,
            label: window.siyuan.languages["heading" + level],
            click() {
                fetchPost("/api/block/getHeadingLevelTransaction", {
                    id,
                    level
                }, (response) => {
                    response.data.doOperations.forEach((operation: IOperation, index: number) => {
                        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                            itemElement.outerHTML = operation.data;
                        });
                        // 使用 outer 后元素需要重新查询
                        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach((itemElement: HTMLElement) => {
                            mathRender(itemElement);
                        });
                        if (index === 0) {
                            focusBlock(protyle.wysiwyg.element.querySelector(`[data-node-id="${operation.id}"]`), protyle.wysiwyg.element, true);
                        }
                    });
                    transaction(protyle, response.data.doOperations, response.data.undoOperations);
                });
            }
        };
    }

    private genClick(nodeElements: Element[], protyle: IProtyle, cb: (e: HTMLElement) => void) {
        updateBatchTransaction(nodeElements, protyle, cb);
        focusBlock(nodeElements[0]);
    }

    private genAlign(nodeElements: Element[], protyle: IProtyle) {
        const disabledRTL = nodeElements.some(e => ["NodeAttributeView", "NodeCodeBlock", "NodeMathBlock"].includes(e.getAttribute("data-type")));
        window.siyuan.menus.menu.append(new MenuItem({
            id: "layout",
            icon: "iconAlignSettings",
            label: window.siyuan.languages.layout,
            type: "submenu",
            submenu: [{
                id: "alignLeft",
                icon: "iconAlignLeft",
                label: window.siyuan.languages.alignLeft,
                accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("av")) {
                            e.style.justifyContent = "";
                        } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                            e.style.margin = "";
                        } else {
                            e.style.textAlign = "left";
                        }
                    });
                }
            }, {
                id: "alignCenter",
                icon: "iconAlignCenter",
                label: window.siyuan.languages.alignCenter,
                accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("av")) {
                            e.style.justifyContent = "center";
                        } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                            e.style.margin = "0 auto";
                        } else {
                            e.style.textAlign = "center";
                        }
                    });
                }
            }, {
                id: "alignRight",
                icon: "iconAlignRight",
                label: window.siyuan.languages.alignRight,
                accelerator: window.siyuan.config.keymap.editor.general.alignRight.custom,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("av")) {
                            e.style.justifyContent = "flex-end";
                        } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                            e.style.margin = "0 0 0 auto";
                        } else {
                            e.style.textAlign = "right";
                        }
                    });
                }
            }, {
                id: "justify",
                icon: "iconAlignJustify",
                label: window.siyuan.languages.justify,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        e.style.textAlign = "justify";
                    });
                }
            }, {
                id: "separator_1",
                type: "separator"
            }, {
                id: "ltr",
                icon: "iconLtr",
                ignore: disabledRTL,
                label: window.siyuan.languages.ltr,
                accelerator: window.siyuan.config.keymap.editor.general.ltr.custom,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("table")) {
                            e.querySelector("table").style.direction = "ltr";
                        } else if (e.getAttribute("data-type") === "NodeHTMLBlock") {
                            (e.querySelector("protyle-html") as HTMLElement).style.direction = "ltr";
                        } else {
                            e.style.direction = "ltr";
                        }
                    });
                }
            }, {
                id: "rtl",
                icon: "iconRtl",
                ignore: disabledRTL,
                label: window.siyuan.languages.rtl,
                accelerator: window.siyuan.config.keymap.editor.general.rtl.custom,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("table")) {
                            e.querySelector("table").style.direction = "rtl";
                        } else if (e.getAttribute("data-type") === "NodeHTMLBlock") {
                            (e.querySelector("protyle-html") as HTMLElement).style.direction = "rtl";
                        } else {
                            e.style.direction = "rtl";
                        }
                    });
                }
            }, {
                id: "separator_2",
                ignore: disabledRTL,
                type: "separator"
            }, {
                id: "clearFontStyle",
                icon: "iconTrashcan",
                label: window.siyuan.languages.clearFontStyle,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.classList.contains("av")) {
                            e.style.justifyContent = "";
                        } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                            e.style.margin = "";
                        } else {
                            e.style.textAlign = "";
                            e.style.direction = "";
                        }
                    });
                }
            }]
        }).element);
    }

    private updateNodeElements(nodeElements: Element[], protyle: IProtyle, inputElement: HTMLInputElement) {
        const undoOperations: IOperation[] = [];
        const operations: IOperation[] = [];
        nodeElements.forEach((e) => {
            undoOperations.push({
                action: "update",
                id: e.getAttribute("data-node-id"),
                data: e.outerHTML
            });
        });
        inputElement.addEventListener(inputElement.type === "number" ? "blur" : "change", () => {
            nodeElements.forEach((e: HTMLElement) => {
                operations.push({
                    action: "update",
                    id: e.getAttribute("data-node-id"),
                    data: e.outerHTML
                });
                if (e.getAttribute("data-subtype") === "echarts") {
                    const chartInstance = window.echarts.getInstanceById(e.querySelector("[_echarts_instance_]").getAttribute("_echarts_instance_"));
                    if (chartInstance) {
                        chartInstance.resize();
                    }
                    chartRender(e);
                }
            });
            transaction(protyle, operations, undoOperations);
            window.siyuan.menus.menu.remove();
            focusBlock(nodeElements[0]);
        });
    }

    private genWidths(nodeElements: Element[], protyle: IProtyle) {
        let rangeElement: HTMLInputElement;
        const firstElement = nodeElements[0] as HTMLElement;
        const styles: IMenu[] = [{
            id: "widthInput",
            iconHTML: "",
            type: "readonly",
            label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${firstElement.style.width.endsWith("px") ? parseInt(firstElement.style.width) : ""}" type="number" style="margin: 4px 8px 4px 0" placeholder="${window.siyuan.languages.width}"><span class="fn__flex-center">px</span></div>`,
            bind: (element) => {
                const inputElement = element.querySelector("input");
                inputElement.addEventListener("input", () => {
                    nodeElements.forEach((item: HTMLElement) => {
                        item.style.width = inputElement.value + "px";
                        item.style.flex = "none";
                    });
                    rangeElement.value = "0";
                    rangeElement.parentElement.setAttribute("aria-label", inputElement.value + "px");
                });
                this.updateNodeElements(nodeElements, protyle, inputElement);
            }
        }];
        ["25%", "33%", "50%", "67%", "75%", "100%"].forEach((item) => {
            styles.push({
                id: "width_" + item,
                iconHTML: "",
                label: item,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        e.style.width = item;
                        e.style.flex = "none";
                        if (e.getAttribute("data-subtype") === "echarts") {
                            const chartInstance = window.echarts.getInstanceById(e.querySelector("[_echarts_instance_]").getAttribute("_echarts_instance_"));
                            if (chartInstance) {
                                chartInstance.resize();
                            }
                        }
                    });
                }
            });
        });
        styles.push({
            id: "separator_1",
            type: "separator"
        });
        const width = firstElement.style.width.endsWith("%") ? parseInt(firstElement.style.width) : 0;
        window.siyuan.menus.menu.append(new MenuItem({
            id: "width",
            icon: "iconWidth",
            label: window.siyuan.languages.width,
            submenu: styles.concat([{
                id: "widthDrag",
                iconHTML: "",
                type: "readonly",
                label: `<div style="margin: 4px 0;" aria-label="${firstElement.style.width.endsWith("px") ? firstElement.style.width : (firstElement.style.width || window.siyuan.languages.default)}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${width}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
                bind: (element) => {
                    rangeElement = element.querySelector("input");
                    rangeElement.addEventListener("input", () => {
                        nodeElements.forEach((e: HTMLElement) => {
                            e.style.width = rangeElement.value + "%";
                            e.style.flex = "none";
                        });
                        rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                    });
                    this.updateNodeElements(nodeElements, protyle, rangeElement);
                }
            }, {
                id: "separator_2",
                type: "separator"
            }, {
                id: "default",
                iconHTML: "",
                label: window.siyuan.languages.default,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.style.width) {
                            e.style.width = "";
                            e.style.flex = "";
                            if (e.getAttribute("data-subtype") === "echarts") {
                                const chartInstance = window.echarts.getInstanceById(e.querySelector("[_echarts_instance_]").getAttribute("_echarts_instance_"));
                                if (chartInstance) {
                                    chartInstance.resize();
                                }
                            }
                        }
                    });
                }
            }]),
        }).element);
    }

    // TODO https://github.com/siyuan-note/siyuan/issues/11055
    private genHeights(nodeElements: Element[], protyle: IProtyle) {
        const matchHeight = nodeElements.find(item => {
            if (!item.classList.contains("p") && !item.classList.contains("code-block") && !item.classList.contains("render-node")) {
                return true;
            }
        });
        if (matchHeight) {
            return;
        }
        let rangeElement: HTMLInputElement;
        const firstElement = nodeElements[0] as HTMLElement;
        const styles: IMenu[] = [{
            id: "heightInput",
            iconHTML: "",
            type: "readonly",
            label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${firstElement.style.height.endsWith("px") ? parseInt(firstElement.style.height) : ""}" type="number" style="margin: 4px 8px 4px 0" placeholder="${window.siyuan.languages.height}"><span class="fn__flex-center">px</span></div>`,
            bind: (element) => {
                const inputElement = element.querySelector("input");
                inputElement.addEventListener("input", () => {
                    nodeElements.forEach((item: HTMLElement) => {
                        item.style.height = inputElement.value + "px";
                        item.style.flex = "none";
                    });
                    rangeElement.value = "0";
                    rangeElement.parentElement.setAttribute("aria-label", inputElement.value + "px");
                });
                this.updateNodeElements(nodeElements, protyle, inputElement);
            }
        }];
        ["25%", "33%", "50%", "67%", "75%", "100%"].forEach((item) => {
            styles.push({
                id: "height_" + item,
                iconHTML: "",
                label: item,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        e.style.height = item;
                        e.style.flex = "none";
                    });
                }
            });
        });
        styles.push({
            type: "separator"
        });
        const height = firstElement.style.height.endsWith("%") ? parseInt(firstElement.style.height) : 0;
        window.siyuan.menus.menu.append(new MenuItem({
            id: "heightDrag",
            label: window.siyuan.languages.height,
            submenu: styles.concat([{
                iconHTML: "",
                type: "readonly",
                label: `<div style="margin: 4px 0;" aria-label="${firstElement.style.height.endsWith("px") ? firstElement.style.height : (firstElement.style.height || window.siyuan.languages.default)}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${height}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
                bind: (element) => {
                    rangeElement = element.querySelector("input");
                    rangeElement.addEventListener("input", () => {
                        nodeElements.forEach((e: HTMLElement) => {
                            e.style.height = rangeElement.value + "%";
                            e.style.flex = "none";
                        });
                        rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                    });
                    this.updateNodeElements(nodeElements, protyle, rangeElement);
                }
            }, {
                type: "separator"
            }, {
                id: "default",
                iconHTML: "",
                label: window.siyuan.languages.default,
                click: () => {
                    this.genClick(nodeElements, protyle, (e: HTMLElement) => {
                        if (e.style.height) {
                            e.style.height = "";
                            e.style.overflow = "";
                        }
                    });
                }
            }]),
        }).element);
    }

    private genCopyTextRef(selectsElement: Element[]): false | IMenu {
        if (isNotEditBlock(selectsElement[0])) {
            return false;
        }
        return {
            id: "copyText",
            iconHTML: "",
            accelerator: window.siyuan.config.keymap.editor.general.copyText.custom,
            label: window.siyuan.languages.copyText,
            click() {
                // 用于标识复制文本 *
                selectsElement[0].setAttribute("data-reftext", "true");
                focusByRange(getEditorRange(selectsElement[0]));
                document.execCommand("copy");
            }
        };
    }
    // S-forge: 结束

    /**
     * 渲染 Gutter 内容
     *
     * 这是 Gutter 的核心渲染方法，负责根据当前元素和目标位置渲染 Gutter 的内容。
     * 它会生成适当的按钮、图标和提示信息，并设置正确的位置。
     *
     * @param protyle 编辑器实例
     * @param element 需要渲染 Gutter 的目标元素
     * @param target 可选的目标子元素，用于精确定位
     */
    public render(protyle: IProtyle, element: Element, target?: Element) {
        renderGutter(protyle, element, {
            target,
            gutterElement: this.element,
            gutterTip: this.gutterTip
        });
    }
}
