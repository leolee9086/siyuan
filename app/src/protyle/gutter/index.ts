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
import {MenuItem} from "../../menus/Menu.Item";
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
import { getTopAloneElement, getParentBlock } from "../wysiwyg/getBlock";
import { getLangByType } from "../../block/util";

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

// 块类型 data-type 到本地化名称键的映射，用于块标提示中的 ${x}
const BLOCK_TYPE_LANG_KEYS: { [key: string]: string } = {
    NodeParagraph: "paragraph",
    NodeHeading: "headings",
    NodeList: "list1",
    NodeListItem: "listItem",
    NodeBlockquote: "quote",
    NodeCallout: "callout",
    NodeSuperBlock: "superBlock",
    NodeTable: "table",
    NodeCodeBlock: "code",
    NodeMathBlock: "math",
    NodeBlockQueryEmbed: "blockEmbed",
    NodeThematicBreak: "line",
    NodeVideo: "video",
    NodeAudio: "audio",
    NodeWidget: "widget",
    NodeAttributeView: "database",
};

// 根据块 data-type 返回本地化的类型名，用于块标拖拽提示「拖拽 ${x} 移动位置」
const getBlockTypeName = (type: string) => {
    const langKey = BLOCK_TYPE_LANG_KEYS[type];
    if (langKey && (window.siyuan.languages as { [key: string]: string })[langKey]) {
        return (window.siyuan.languages as { [key: string]: string })[langKey];
    }
    // 未知类型兜底，与拖拽 ghost 文案保持一致
    return getLangByType(type);
};
export class Gutter {
    /**
     * Gutter 的 DOM 元素，包含所有块操作按钮
     */
    public element: HTMLElement;
    // S-forge: 普通块标提示模板（含 ${x} 块类型占位符），反链面板使用 gutterTipBacklink
    private gutterTip: string;
    // S-forge: 反链面板专用提示模板，含 ${x} 块类型占位符
    private gutterTipBacklink: string;

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

        // 初始化反链面板提示文本
        // S-forge: 反链面板使用独立的 gutterTipBacklink，支持 ${x} 块类型占位符
        this.gutterTipBacklink = siyuanI18n.gutterTipBacklink.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"));

        // 如果不是 Mac 系统，将 Mac 风格的快捷键符号转换为 Windows/Linux 风格
        if (!isMac()) {
            this.gutterTip = this.gutterTip.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
            this.gutterTipBacklink = this.gutterTipBacklink.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
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

    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        return buildGutterMenu({ protyle, buttonElement });
    }

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
        // https://github.com/siyuan-note/siyuan/issues/4659
        if (protyle.title && protyle.title.element.getAttribute("data-render") !== "true") {
            return;
        }
        // 防止划选时触碰图标导致 hl 无法移除
        const selectElement = protyle.element.querySelector(".protyle-select");
        if (selectElement && !selectElement.classList.contains("fn__none")) {
            return;
        }
        let html = "";
        let nodeElement = element;
        let space = 0;
        let index = 0;
        let listItem;
        let hideParent = false;
        while (nodeElement) {
            let parentElement = hasClosestBlock(nodeElement.parentElement);
            if (!isInEmbedBlock(nodeElement)) {
                let type: string;
                if (!hideParent) {
                    type = nodeElement.getAttribute("data-type");
                }
                let dataNodeId = nodeElement.getAttribute("data-node-id");
                if (type === "NodeAttributeView" && target) {
                    const rowElement = hasClosestByClassName(target, "av__row");
                    if (rowElement && !rowElement.classList.contains("av__row--header") && rowElement.dataset.id) {
                        element = rowElement;
                        const bodyElement = hasClosestByClassName(rowElement, "av__body") as HTMLElement;
                        let iconAriaLabel = isMac() ? window.siyuan.languages.rowTip : window.siyuan.languages.rowTip.replace("⇧", "Shift+");
                        if (protyle.disabled) {
                            iconAriaLabel = window.siyuan.languages.rowTip.substring(0, window.siyuan.languages.rowTip.indexOf("<br"));
                        } else if (rowElement.querySelector('[data-dtype="block"]')?.getAttribute("data-detached") === "true") {
                            iconAriaLabel = window.siyuan.languages.rowTip.substring(0, window.siyuan.languages.rowTip.lastIndexOf("<br"));
                        }
                        html = `<button data-type="NodeAttributeViewRowMenu" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${iconAriaLabel}"><svg><use xlink:href="#iconDrag"></use></svg><span ${protyle.disabled ? "" : 'draggable="true" class="fn__grab"'}></span></button>`;
                        if (!protyle.disabled) {
                            html = `<button data-type="NodeAttributeViewRow" data-node-id="${dataNodeId}" data-row-id="${rowElement.dataset.id}" data-group-id="${bodyElement.dataset.groupId || ""}" class="ariaLabel" data-position="parentW" aria-label="${isMac() ? window.siyuan.languages.addBelowAbove : window.siyuan.languages.addBelowAbove.replace("⌥", "Alt+")}"><svg><use xlink:href="#iconAdd"></use></svg></button>${html}`;
                        }
                        break;
                    }
                }
                if (index === 0) {
                    // 不单独显示，要不然在块的间隔中，gutter 会跳来跳去的
                    if (["NodeBlockquote", "NodeList", "NodeCallout", "NodeSuperBlock"].includes(type)) {
                        if (target && type === "NodeCallout") {
                            // Callout 标题需显示
                            const calloutInfoElement = hasTopClosestByClassName(target, "callout-info");
                            if (calloutInfoElement) {
                                element = calloutInfoElement;
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                    }

                    let topElement = getTopAloneElement(nodeElement);
                    // https://github.com/siyuan-note/siyuan/issues/17751 第二点
                    if (topElement === nodeElement.parentElement && nodeElement.childElementCount > 3 &&
                        nodeElement.classList.contains("li")) {
                        topElement = nodeElement;
                    }
                    // 提示下方仅有单个列表
                    if (topElement.classList.contains("callout") && !nodeElement.classList.contains("callout") &&
                        getParentBlock(nodeElement) !== topElement) {
                        topElement = topElement.querySelector("[data-node-id]");
                    }
                    listItem = topElement.querySelector(".li") || topElement.querySelector(".list");
                    // 嵌入块中有列表时块标显示位置错误 https://github.com/siyuan-note/siyuan/issues/6254
                    if (isInEmbedBlock(listItem) || isInAVBlock(listItem) || hasClosestByClassName(nodeElement, "callout")) {
                        listItem = undefined;
                    }
                    // 标题（除列表下的）、提示下的块必须显示
                    if (topElement !== nodeElement && type !== "NodeHeading" && !hasClosestByClassName(nodeElement, "callout")) {
                        while (nodeElement !== topElement) {
                            nodeElement = nodeElement.parentElement;
                            // > > > > 1 left 位置
                            if (nodeElement.parentElement.classList.contains("bq")) {
                                space += 10;
                            }
                        }
                        parentElement = hasClosestBlock(nodeElement.parentElement);
                        type = nodeElement.getAttribute("data-type");
                        dataNodeId = nodeElement.getAttribute("data-node-id");
                    }
                }
                // - > # 1 \n  > 2
                if (type === "NodeListItem" && index > 0) {
                    // 列表项内的块不显示块标
                    html = "";
                }
                index += 1;
                // 按块类型与是否反链面板生成提示，${x} 替换为该块的本地化类型名（如「段落/表格/超级块」）
                // 使用回调返回值，避免类型名中可能的 $ 字符被当作替换模式
                let gutterTip = (protyle.options.backlinkData ? this.gutterTipBacklink : this.gutterTip)
                    .replace("${x}", () => getBlockTypeName(type));
                if (protyle.disabled) {
                    gutterTip = gutterTip.split("<br>").splice(0, 2).join("<br>");
                }

                let popoverHTML = "";
                if (protyle.options.backlinkData) {
                    popoverHTML = `class="popover__block" data-id="${dataNodeId}"`;
                }
                const buttonHTML = type ? `<button class="ariaLabel" data-delay="500" data-position="parentW" aria-label="${gutterTip}"
data-type="${type}" data-subtype="${nodeElement.getAttribute("data-subtype")}" data-node-id="${dataNodeId}">
    <svg><use xlink:href="#${getIconByType(type, nodeElement.getAttribute("data-subtype"))}"></use></svg>
    <span ${popoverHTML} ${protyle.disabled ? "" : 'draggable="true"'}></span>
</button>` : "";
                if (!hideParent) {
                    html = buttonHTML + html;
                }
                let foldHTML = "";
                if (type === "NodeListItem" && nodeElement.childElementCount > 3 || type === "NodeHeading") {
                    const fold = nodeElement.getAttribute("fold");
                    foldHTML = `<button class="ariaLabel" data-delay="500" data-position="parentW" aria-label="${window.siyuan.languages.fold}"
data-type="fold" style="cursor:inherit;"><svg style="width: 10px;${fold && fold === "1" ? "" : "transform:rotate(90deg)"}"><use xlink:href="#iconPlay"></use></svg></button>`;
                }
                if (type === "NodeListItem" || type === "NodeList") {
                    listItem = nodeElement;
                    if (type === "NodeListItem" && nodeElement.childElementCount > 3) {
                        html = buttonHTML + foldHTML;
                    }
                }
                if (type === "NodeHeading") {
                    html = html + foldHTML;
                }
                if (["NodeBlockquote", "NodeCallout"].includes(type)) {
                    space += 10;
                }
                let previousBlock = nodeElement.previousElementSibling;
                while (previousBlock && !previousBlock.getAttribute("data-node-id")) {
                    previousBlock = previousBlock.previousElementSibling;
                }
                if ((previousBlock && previousBlock.getAttribute("data-node-id")) ||
                    nodeElement.parentElement.classList.contains("callout-content")) {
                    // 前一个块存在时，只显示到当前层级
                    hideParent = true;
                    // 由于折叠块的第二个子块在界面上不显示，因此移除块标 https://github.com/siyuan-note/siyuan/issues/14304
                    if (parentElement && parentElement.getAttribute("fold") === "1") {
                        return;
                    }
                    // 列表项中的引述块中的第二个段落块块标和引述块左侧样式重叠
                    if (parentElement && ["NodeBlockquote", "NodeCallout"].includes(parentElement.getAttribute("data-type"))) {
                        space += 10;
                    }
                }
            }

            if (parentElement) {
                nodeElement = parentElement;
            } else {
                break;
            }
        }
        let match = true;
        // 统计时排除块标边缘框线与+号元素，它们由 render 末尾单独追加，不参与防抖比较
        const buttonsElement = this.element.querySelectorAll("button:not(.protyle-gutters__line):not(.protyle-gutters__plus)");
        if (buttonsElement.length !== html.split("</button>").length - 1) {
            match = false;
        } else {
            Array.from(buttonsElement).find(item => {
                const id = item.getAttribute("data-node-id");
                if (id && html.indexOf(id) === -1) {
                    match = false;
                    return true;
                }
                const rowId = item.getAttribute("data-row-id");
                if ((rowId && html.indexOf(rowId) === -1) || (!rowId && html.indexOf("NodeAttributeViewRowMenu") > -1)) {
                    match = false;
                    return true;
                }
            });
        }
        // 防止抖动 https://github.com/siyuan-note/siyuan/issues/4166
        if (match && this.element.childElementCount > 0) {
            this.element.classList.remove("fn__none");
            return;
        }
        this.element.innerHTML = html;
        this.element.classList.remove("fn__none");
        this.element.style.width = "";
        const contentTop = protyle.contentElement.getBoundingClientRect().top;
        let rect = element.getBoundingClientRect();
        let marginHeight = 0;
        if (listItem && !window.siyuan.config.editor.rtl && getComputedStyle(element).direction !== "rtl") {
            rect = listItem.firstElementChild.getBoundingClientRect();
            space = 0;
        } else if (nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed") {
            rect = nodeElement.getBoundingClientRect();
            space = 0;
        } else if (!element.classList.contains("av__row")) {
            if (rect.height < Math.floor(window.siyuan.config.editor.fontSize * 1.625) + 8 ||
                (rect.height > Math.floor(window.siyuan.config.editor.fontSize * 1.625) + 8 && rect.height < Math.floor(window.siyuan.config.editor.fontSize * 1.625) * 2 + 8)) {
                marginHeight = (rect.height - this.element.clientHeight) / 2;
            } else if ((nodeElement.getAttribute("data-type") === "NodeAttributeView" || element.getAttribute("data-type") === "NodeAttributeView") &&
                contentTop < rect.top) {
                marginHeight = 8;
            }
        }
        this.element.style.top = `${Math.max(rect.top, contentTop) + marginHeight}px`;
        let left = rect.left - this.element.clientWidth - space;
        if ((nodeElement.getAttribute("data-type") === "NodeBlockQueryEmbed" && this.element.childElementCount === 1)) {
            // 嵌入块为列表时
            left = nodeElement.getBoundingClientRect().left - this.element.clientWidth - space;
        } else if (element.classList.contains("av__row")) {
            // 为数据库行
            left = nodeElement.getBoundingClientRect().left - this.element.clientWidth - space + parseInt(getComputedStyle(nodeElement).paddingLeft);
        }
        this.element.style.left = `${left}px`;
        if (left < this.element.parentElement.getBoundingClientRect().left) {
            this.element.style.width = "24px";
            // 需加 2，否则和折叠标题无法对齐
            this.element.style.left = `${rect.left - this.element.clientWidth - space / 2 + 3}px`;
            html = "";
            Array.from(this.element.children).reverse().forEach((item, index) => {
                // 跳过块标边缘框线与+号元素，避免被压缩重排
                if (item.classList.contains("protyle-gutters__line") || item.classList.contains("protyle-gutters__plus")) {
                    return;
                }
                if (index !== 0) {
                    (item.firstElementChild as HTMLElement).style.height = "14px";
                }
                html += item.outerHTML;
            });
            this.element.innerHTML = html;
        } else {
            this.element.querySelectorAll("svg").forEach(item => {
                item.style.height = "";
            });
        }
        // 追加块标边缘悬浮触发的插入元素（默认隐藏，悬浮块标显示线条，悬浮线条变+号），由 mousemove 定位
        // 追加块标边缘的框线（悬浮块标显示）与+号（悬浮框线显示），默认隐藏，由 mousemove 定位
        // 双元素：框线贴块标边缘不移动（避免闪烁），+号独立定位在外偏位置，tooltip 基于+号元素对齐
        this.element.insertAdjacentHTML("beforeend", `<button class="protyle-gutters__line" data-type="gutterLineBefore" style="display:none"></button><button class="protyle-gutters__line" data-type="gutterLineAfter" style="display:none"></button><button class="protyle-gutters__plus ariaLabel" data-type="gutterPlusBefore" data-position="4west" aria-label="${window.siyuan.languages.insertBefore}" style="display:none"><svg><use xlink:href="#iconAdd"></use></svg></button><button class="protyle-gutters__plus ariaLabel" data-type="gutterPlusAfter" data-position="4west" aria-label="${window.siyuan.languages.insertAfter}" style="display:none"><svg><use xlink:href="#iconAdd"></use></svg></button>`);
    }
}
