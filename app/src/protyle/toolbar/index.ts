import { Divider } from "./Divider";
import { Font, hasSameTextStyle } from "./Font";
import { ToolbarItem } from "./ToolbarItem";
import {
    fixTableRange,
    focusBlock,
    focusByRange,
    focusByWbr,
    getEditorRange,
    getSelectionPosition,
    selectAll,
    setFirstNodeRange,
    setLastNodeRange
} from "../util/selection";
import { hasClosestBlock, hasClosestByAttribute, hasClosestByClassName } from "../util/hasClosest";
import { Link } from "./Link";
import { setPosition } from "../../util/setPosition";
import { transaction, updateTransaction } from "../wysiwyg/transaction";
import { Constants } from "../../constants";
import { copyPlainText, openByMobile, readClipboard, setStorageVal } from "../util/compatibility";
import { upDownHint } from "../../util/upDownHint";
import { highlightRender } from "../render/highlightRender";
import { getContenteditableElement, hasNextSibling, hasPreviousSibling } from "../wysiwyg/getBlock";
import { processRender } from "../util/processCode";
import { BlockRef } from "./BlockRef";
import { hintRenderTemplate, hintRenderWidget } from "../hint/extend";
import { blockRender } from "../render/blockRender";
/// #if !BROWSER
import { openBy } from "../../editor/utils.openBy";
/// #endif
import { fetchPost } from "../../util/fetch";
import { isArrayEqual, isMobile } from "../../util/functions";
import * as dayjs from "dayjs";
import { insertEmptyBlock } from "../../block/util";
import { matchHotKey } from "../util/hotKey";
import { hideElements } from "../ui/hideElements";
import { electronUndo } from "../undo";
import { previewTemplate, toolbarKeyToMenu } from "./util";
import { InlineMath } from "./InlineMath";
import { InlineMemo } from "./InlineMemo";
import { confirmDialog } from "../../dialog/confirmDialog";
import { paste, pasteAsPlainText, pasteEscaped } from "../util/paste";
import { escapeHtml } from "../../util/escape";
import { resizeSide } from "../../history/resizeSide";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { mergeNodes } from "../../util/DOM/rangeOperations";
import { 显示挂件选择 } from "./showWidget";
import { 显示内容操作 } from "./showContent";
import { 显示代码语言选择 } from "./showCodeLanguage";
import { 显示模板选择 } from "./showTpl";
import { 显示特殊类型菜单, 整理零宽空格, 合并相邻同类型元素, 移除内联标记, 添加内联标记, 准备标记内容, 清理内联标记内容, 构建标记上下文 } from "./inlineMark";
import {
    确定渲染标题,
    获取文本框初始值,
    检查固定状态,
    生成渲染面板HTML,
    处理头部按钮点击,
    处理文本输入,
    处理键盘事件,
    发射插件打开事件,
    导出为图片,
    创建关闭回调,
    创建自动高度函数,
    type 渲染面板上下文
} from "./showRender";
/**
 * 需要拆分重构,直到消除所有lint错误和ts错误
 */
export class Toolbar {
    public element: HTMLElement;
    public subElement: HTMLElement;
    public subElementCloseCB: (() => void) | undefined;
    public range: Range | undefined;
    public toolbarHeight: number;

    constructor(protyle: IProtyle) {
        const options = protyle.options;
        const element = document.createElement("div");
        element.className = "protyle-toolbar fn__none";
        this.element = element;
        this.subElement = document.createElement("div");
        /// #if MOBILE
        this.subElement.className = "protyle-util fn__none protyle-util--mobile";
        /// #else
        this.subElement.className = "protyle-util fn__none";
        /// #endif
        this.toolbarHeight = 29;
        for (const item of protyle.app.plugins) {
            const pluginToolbar = item.updateProtyleToolbar(options.toolbar);
            for (const toolbarItem of pluginToolbar) {
                if (typeof toolbarItem === "string" || Constants.INLINE_TYPE.concat("|").includes(toolbarItem.name) || !toolbarItem.hotkey) {
                    continue;
                }
                if (typeof toolbarItem.hotkey !== "string") {
                    toolbarItem.hotkey = "";
                }
                if (window.siyuan.config.keymap.plugin && window.siyuan.config.keymap.plugin[item.name] && window.siyuan.config.keymap.plugin[item.name][toolbarItem.name]) {
                    toolbarItem.hotkey = window.siyuan.config.keymap.plugin[item.name][toolbarItem.name].custom;
                }
            }
            options.toolbar = toolbarKeyToMenu(pluginToolbar);
        }
        for (const menuItem of options.toolbar) {
            const itemElement = this.genItem(protyle, menuItem as IMenuItem);
            this.element.appendChild(itemElement);
        }
    }

    public update(protyle: IProtyle) {
        this.element.innerHTML = "";
        protyle.options.toolbar = toolbarKeyToMenu(Constants.PROTYLE_TOOLBAR);
        for (const item of protyle.app.plugins) {
            const pluginToolbar = item.updateProtyleToolbar(protyle.options.toolbar);
            for (const toolbarItem of pluginToolbar) {
                if (typeof toolbarItem === "string" || Constants.INLINE_TYPE.concat("|").includes(toolbarItem.name) || !toolbarItem.hotkey) {
                    continue;
                }
                if (typeof toolbarItem.hotkey !== "string") {
                    toolbarItem.hotkey = "";
                }
                if (window.siyuan.config.keymap.plugin && window.siyuan.config.keymap.plugin[item.name] && window.siyuan.config.keymap.plugin[item.name][toolbarItem.name]) {
                    toolbarItem.hotkey = window.siyuan.config.keymap.plugin[item.name][toolbarItem.name].custom;
                }
            }
            protyle.options.toolbar = toolbarKeyToMenu(pluginToolbar);
        }
        for (const menuItem of protyle.options.toolbar) {
            const itemElement = this.genItem(protyle, menuItem as IMenuItem);
            this.element.appendChild(itemElement);
        }
    }

    public render(protyle: IProtyle, range: Range, event?: KeyboardEvent) {
        this.range = range;
        let nodeElement = hasClosestBlock(range.startContainer);
        if (isMobile() || !nodeElement || protyle.disabled || nodeElement.classList.contains("av")) {
            this.element.classList.add("fn__none");
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/5157
        let hasText = false;
        Array.from(range.cloneContents().childNodes).find(item => {
            // zwsp 不显示工具栏
            if (item.textContent.length > 0 && item.textContent !== Constants.ZWSP) {
                if (item.nodeType === 1 && (item as HTMLElement).classList.contains("img")) {
                    // 图片不显示工具栏
                } else {
                    hasText = true;
                    return true;
                }
            }
        });
        if (!hasText ||
            // 拖拽图片到最右侧
            (range.commonAncestorContainer.nodeType !== 3 && (range.commonAncestorContainer as HTMLElement).classList.contains("img"))) {
            this.element.classList.add("fn__none");
            return;
        }
        // shift+方向键或三击选中，不同的块 https://github.com/siyuan-note/siyuan/issues/3891
        const startElement = hasClosestBlock(range.startContainer);
        const endElement = hasClosestBlock(range.endContainer);
        if (startElement && endElement && startElement !== endElement) {
            if (event) { // 在 keyup 中使用 shift+方向键选中
                if (event.key === "ArrowLeft") {
                    this.range = setLastNodeRange(getContenteditableElement(startElement), range, false);
                } else if (event.key === "ArrowRight") {
                    this.range = setFirstNodeRange(getContenteditableElement(endElement), range);
                    this.range.collapse(false);
                } else if (event.key === "ArrowUp") {
                    this.range = setFirstNodeRange(getContenteditableElement(endElement), range);
                    nodeElement = hasClosestBlock(endElement);
                    if (!nodeElement) {
                        return;
                    }
                } else if (event.key === "ArrowDown") {
                    this.range = setLastNodeRange(getContenteditableElement(startElement), range, false);
                }
            } else {
                this.range = setLastNodeRange(getContenteditableElement(nodeElement), range, false);
            }
            focusByRange(this.range);
            if (this.range.toString() === "") {
                this.element.classList.add("fn__none");
                return;
            }
        }
        // 需放在 range 修改之后，否则 https://github.com/siyuan-note/siyuan/issues/4726
        if (nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
            this.element.classList.add("fn__none");
            return;
        }
        const rangePosition = getSelectionPosition(nodeElement, range, true);
        this.element.classList.remove("fn__none");
        this.toolbarHeight = this.element.clientHeight;
        const y = rangePosition.isBottom ?
            Math.min(rangePosition.top + 4, protyle.element.getBoundingClientRect().bottom - this.toolbarHeight) :
            Math.max(rangePosition.top - this.toolbarHeight - 4, protyle.element.getBoundingClientRect().top + 30);
        this.element.setAttribute("data-inity", y + Constants.ZWSP + protyle.contentElement.scrollTop.toString());
        setPosition(this.element, rangePosition.left - this.element.clientWidth / 4, y);

        this.element.querySelectorAll(".protyle-toolbar__item--current").forEach(item => {
            item.classList.remove("protyle-toolbar__item--current");
        });
        const types = this.getCurrentType();
        types.forEach(item => {
            if (["search-mark", "a", "block-ref", "virtual-block-ref", "text", "file-annotation-ref", "inline-math",
                "inline-memo", "", "backslash"].includes(item)) {
                return;
            }
            const itemElement = this.element.querySelector(`[data-type="${item}"]`);
            if (itemElement) {
                itemElement.classList.add("protyle-toolbar__item--current");
            }
        });
    }

    public getCurrentType(range = this.range) {
        let types: string[] = [];
        let startElement = range.startContainer as HTMLElement;
        if (startElement.nodeType === 3) {
            startElement = startElement.parentElement;
        } else if (startElement.childElementCount > 0 && startElement.childNodes[range.startOffset]?.nodeType !== 3) {
            startElement = startElement.childNodes[range.startOffset] as HTMLElement;
            if (startElement?.tagName === "WBR") {
                startElement = startElement.parentElement;
            }
        }
        if (!startElement || startElement.nodeType === 3) {
            return [];
        }
        if (!["DIV", "TD", "TH", "TR"].includes(startElement.tagName)) {
            types = (startElement.getAttribute("data-type") || "").split(" ");
        }
        let endElement = range.endContainer as HTMLElement;
        if (endElement.nodeType === 3) {
            endElement = endElement.parentElement;
        } else if (endElement.childElementCount > 0 && endElement.childNodes[range.endOffset]?.nodeType !== 3) {
            endElement = endElement.childNodes[range.endOffset] as HTMLElement;
        }
        if (types.length === 0 && (!endElement || endElement.nodeType === 3)) {
            return [];
        }
        if (endElement && !["DIV", "TD", "TH", "TR"].includes(endElement.tagName) && startElement !== endElement) {
            types = types.concat((endElement.getAttribute("data-type") || "").split(" "));
        }
        range.cloneContents().childNodes.forEach((item: HTMLElement) => {
            if (item.nodeType !== 3) {
                types = types.concat((item.getAttribute("data-type") || "").split(" "));
            }
        });
        types = [...new Set(types)];
        types.find((item, index) => {
            if (item === "") {
                types.splice(index, 1);
                return true;
            }
        });
        return types;
    }

    public setInlineMark(protyle: IProtyle, type: string, action: "range" | "toolbar", textObj?: ITextOption) {
        const nodeElement = hasClosestBlock(this.range.startContainer);
        if (!nodeElement || nodeElement.getAttribute("data-type") === "NodeCodeBlock") {
            return;
        }
        const endElement = hasClosestBlock(this.range.endContainer);
        if (!endElement) {
            return;
        }
        // 三击后还没有重新纠正 range 时使用快捷键标记会导致异常 https://github.com/siyuan-note/siyuan/issues/7068
        if (nodeElement !== endElement) {
            this.range = setLastNodeRange(getContenteditableElement(nodeElement), this.range, false);
        }


        // 构建上下文信息
        const context = 构建标记上下文(this.range, type, textObj);
        if (context.shouldReturn) {
            return;
        }
        const { rangeTypes, isSameNode, selectText } = context;
        let keepZWPS = context.keepZWPS;
        fixTableRange(this.range);

        const { contents, html, needWrapTarget, isEndSpan } = 准备标记内容(
            this.range,
            nodeElement,
            isSameNode,
            hasPreviousSibling,
            hasNextSibling
        );

        清理内联标记内容(contents, this.range, needWrapTarget, selectText);

        const toolbarElement = isMobile() ? document.querySelector("#keyboardToolbar .keyboard__dynamic").nextElementSibling : this.element;
        const actionBtn = action === "toolbar" ? toolbarElement.querySelector(`[data-type="${type}"]`) : undefined;
        let newNodes: Node[] = [];
        let startContainer: Node | undefined;
        let endContainer: Node | undefined;
        let startOffset: number | undefined;
        let endOffset: number | undefined;
        if (type === "clear" || actionBtn?.classList.contains("protyle-toolbar__item--current") || (
            action === "range" && rangeTypes.length > 0 && rangeTypes.includes(type) && !textObj
        )) {
            // 移除
            const result = 移除内联标记(
                contents as DocumentFragment,
                type,
                rangeTypes,
                toolbarElement,
                actionBtn,
                textObj
            );
            newNodes = result.newNodes;
            startContainer = result.startContainer;
            startOffset = result.startOffset;
            keepZWPS = result.keepZWPS;
        } else {
            // 添加
            const addResult = 添加内联标记(
                contents as DocumentFragment,
                type,
                rangeTypes,
                toolbarElement,
                actionBtn,
                textObj,
                selectText,
                isEndSpan,
                !this.element.classList.contains("fn__none")
            );
            newNodes = addResult.newNodes;
            keepZWPS = addResult.keepZWPS;
        }
        // 插入元素
        for (let i = newNodes.length - 1; i > -1; i--) {
            this.range.insertNode(newNodes[i]);
        }
        if (newNodes.length === 1 && newNodes[0].textContent === Constants.ZWSP) {
            this.range.setStart(newNodes[0], 1);
            this.range.collapse(true);
            if (newNodes[0].nodeType !== 3) {
                // 不选中后，ctrl+g 光标重置
                const currentType = ((newNodes[0] as HTMLElement).getAttribute("data-type") || "").split(" ");
                if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
                    keepZWPS = false;
                }
            }
        }
        if (!keepZWPS) {
            // 合并元素
            const mergeResult = 合并相邻同类型元素(
                newNodes,
                hasPreviousSibling,
                hasNextSibling,
                isArrayEqual,
                hasSameTextStyle
            );
            if (mergeResult.startContainer) {
                startContainer = mergeResult.startContainer;
            }
            if (mergeResult.endContainer) {
                endContainer = mergeResult.endContainer;
            }
            if (mergeResult.startOffset !== undefined) {
                startOffset = mergeResult.startOffset;
            }
            if (mergeResult.endOffset !== undefined) {
                endOffset = mergeResult.endOffset;
            }
            // 整理 zwsp
            整理零宽空格(newNodes, hasPreviousSibling, hasNextSibling);
        }
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, html);
        nodeElement.querySelectorAll("wbr").forEach(item => {
            item.remove();
        });
        if (startContainer && typeof startOffset === "number") {
            if (startContainer.nodeType === 3) {
                this.range.setStart(startContainer, startOffset);
            } else {
                this.range.setStart(startContainer.firstChild, startOffset);
            }
        }

        if (endContainer && typeof endOffset === "number") {
            if (endContainer.nodeType === 3) {
                this.range.setEnd(endContainer, endOffset);
            } else {
                this.range.setEnd(endContainer.firstChild, endOffset);
            }
        }
        focusByRange(this.range);

        显示特殊类型菜单(protyle, newNodes[0] as HTMLElement, type, selectText, newNodes, nodeElement, html);
        return newNodes;
    }

    public showRender(protyle: IProtyle, renderElement: Element, updateElements?: Element[], oldHTML?: string) {
        const nodeElement = hasClosestBlock(renderElement);
        if (!nodeElement) {
            return;
        }
        hideElements(["hint"], protyle);
        window.siyuan.menus.menu.remove();

        const id = nodeElement.getAttribute("data-node-id") ?? "";
        const types = (renderElement.getAttribute("data-type") ?? "").split(" ");
        const html = oldHTML ?? nodeElement.outerHTML;
        const subtype = renderElement.getAttribute("data-subtype");
        const 是否行内备注 = types.includes("inline-memo");

        // 确定标题和占位符
        const { 标题, 占位符 } = 确定渲染标题(subtype, types, 是否行内备注);

        // 检查固定状态
        const { 是否固定, 固定样式, 是否拖拽中, 刷新按钮激活 } = 检查固定状态(this.subElement);

        if (!是否固定) {
            this.subElement.style.width = "";
            this.subElement.style.padding = "0";
        }

        // 生成面板 HTML
        this.subElement.innerHTML = 生成渲染面板HTML({
            标题,
            占位符,
            是否固定,
            是否禁用: protyle.disabled,
            是否行内备注,
            类型列表: types,
            渲染元素宽度: renderElement.clientWidth,
            是否拖拽中,
            刷新按钮激活
        });

        // 获取元素引用
        const textElement = this.subElement.querySelector(".b3-text-field") as HTMLTextAreaElement;
        const headerElement = this.subElement.querySelector(".block__icons");
        if (!headerElement) {
            return;
        }

        // 设置初始值
        textElement.value = 获取文本框初始值(renderElement, types, 是否行内备注);
        const oldTextValue = textElement.value;

        // 显示面板并计算位置
        this.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
        this.subElement.classList.remove("fn__none");
        const nodeRect = renderElement.getBoundingClientRect();
        this.element.classList.add("fn__none");

        // 创建上下文
        const 上下文: 渲染面板上下文 = {
            protyle,
            renderElement,
            nodeElement,
            updateElements,
            subElement: this.subElement,
            textElement,
            types,
            是否行内备注,
            id,
            html,
            range: this.range
        };

        // 创建自动高度函数
        const autoHeight = 创建自动高度函数(
            { textElement, nodeRect, types, 是否行内备注 },
            this.subElement
        );

        // 创建导出图片回调
        const exportImg = () => 导出为图片(renderElement);

        // 绑定事件
        headerElement.addEventListener("click", (event: MouseEvent) => {
            处理头部按钮点击(event, headerElement, 上下文, exportImg);
        });

        textElement.addEventListener("input", (event) => {
            处理文本输入(event, 上下文, autoHeight);
        });

        textElement.addEventListener("keydown", (event: KeyboardEvent) => {
            处理键盘事件(event, 上下文);
        });

        // 设置关闭回调
        this.subElementCloseCB = 创建关闭回调(上下文, oldTextValue, this.range);

        // 应用固定样式或自动高度
        if (是否固定 && 固定样式) {
            textElement.style.width = 固定样式.宽度;
            textElement.style.height = 固定样式.高度;
        } else {
            autoHeight();
        }

        // 选中文本
        if (!protyle.disabled) {
            textElement.select();
        }

        // 发射插件事件
        发射插件打开事件(protyle, this, nodeElement, renderElement);
    }

    public showCodeLanguage(protyle: IProtyle, languageElements: HTMLElement[]) {
        显示代码语言选择(protyle, languageElements, this.subElement, this.element, (range: Range) => {
            this.range = range;
        }, this.updateLanguage.bind(this));
        return;
    }

    public showTpl(protyle: IProtyle, nodeElement: HTMLElement, range: Range) {
        显示模板选择(protyle, nodeElement, range, this.subElement, this.element, (range: Range) => {
            this.range = range;
        });
    }

    public showWidget(protyle: IProtyle, nodeElement: HTMLElement, range: Range) {
        显示挂件选择(
            protyle,
            nodeElement,
            range,
            this.subElement,
            this.element,
            (r) => {
                this.range = r;
            }
        );
        this.subElementCloseCB = undefined;
    }

    public showContent(protyle: IProtyle, range: Range, nodeElement: Element) {
        显示内容操作(
            protyle,
            range,
            nodeElement,
            this.subElement,
            this.element,
            (r) => {
                this.range = r;
            }
        );
        this.subElementCloseCB = undefined;
    }

    private genItem(protyle: IProtyle, menuItem: IMenuItem) {
        let menuItemObj;
        switch (menuItem.name) {
            case "strong":
            case "em":
            case "s":
            case "code":
            case "mark":
            case "tag":
            case "u":
            case "sup":
            case "clear":
            case "sub":
            case "kbd":
                menuItemObj = new ToolbarItem(protyle, menuItem);
                break;
            case "block-ref":
                menuItemObj = new BlockRef(protyle, menuItem);
                break;
            case "inline-math":
                menuItemObj = new InlineMath(protyle, menuItem);
                break;
            case "inline-memo":
                menuItemObj = new InlineMemo(protyle, menuItem);
                break;
            case "|":
                menuItemObj = new Divider();
                break;
            case "text":
                menuItemObj = new Font(protyle, menuItem);
                break;
            case "a":
                menuItemObj = new Link(protyle, menuItem);
                break;
            default:
                menuItemObj = new ToolbarItem(protyle, menuItem);
                break;
        }
        if (!menuItemObj) {
            return;
        }
        return menuItemObj.element;
    }

    // 合并多个 text 为一个 text
    private mergeNode(nodes: NodeListOf<ChildNode>) {
        mergeNodes(nodes);
    }

    private updateLanguage(languageElements: HTMLElement[], protyle: IProtyle, selectedLang: string) {
        const currentLang = selectedLang === siyuanI18n.clear ? "" : selectedLang;
        if (protyle.app && protyle.app.plugins) {
            protyle.app.plugins.forEach((plugin: any) => {
                plugin.eventBus.emit("code-language-change", {
                    language: currentLang,
                    languageElements,
                    protyle: protyle
                });
            });
        }
        if (!Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(currentLang)) {
            window.siyuan.storage[Constants.LOCAL_CODELANG] = currentLang;
            setStorageVal(Constants.LOCAL_CODELANG, window.siyuan.storage[Constants.LOCAL_CODELANG]);
        }
        const doOperations: IOperation[] = [];
        const undoOperations: IOperation[] = [];
        languageElements.forEach(item => {
            const nodeElement = hasClosestBlock(item);
            if (nodeElement) {
                const id = nodeElement.getAttribute("data-node-id");
                undoOperations.push({
                    id,
                    data: nodeElement.outerHTML,
                    action: "update"
                });
                item.textContent = selectedLang === siyuanI18n.clear ? "" : selectedLang;
                const editElement = getContenteditableElement(nodeElement);
                if (Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(currentLang)) {
                    nodeElement.dataset.content = editElement.textContent.trim();
                    nodeElement.dataset.subtype = currentLang;
                    nodeElement.className = "render-node";
                    nodeElement.innerHTML = `<div spin="1"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
                    processRender(nodeElement);
                } else {
                    (editElement as HTMLElement).textContent = editElement.textContent;
                    editElement.parentElement.removeAttribute("data-render");
                    highlightRender(nodeElement);
                }
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                doOperations.push({
                    id,
                    data: nodeElement.outerHTML,
                    action: "update"
                });
            }
        });
        transaction(protyle, doOperations, undoOperations);
        this.subElement.classList.add("fn__none");
        focusByRange(this.range);
    }
}
