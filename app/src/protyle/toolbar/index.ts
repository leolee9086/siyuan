import { Constants } from "../../constants";
import { toolbarKeyToMenu } from "./util";
import { genToolbarItem } from "./ToolbarItemFactory";
import { updateLanguage } from "./updateLanguage";
import { showRender } from "./renderPanel";
import { setInlineMark } from "./setInlineMark";
import { renderToolbar, getRangeTypes } from "./renderToolbar";
import { 显示挂件选择 } from "./showWidget";
import { 显示内容操作 } from "./showContent";
import { 显示代码语言选择 } from "./showCodeLanguage";
import { 显示模板选择 } from "./showTpl";
import { isMenuItem } from "./index.guard";
import { getPluginCustomHotkey } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../../platform";
import { activeBlur } from "../../mobile/util/keyboardToolbar";
import { hideElements } from "../ui/hideElements";
import { setPosition } from "../../util/DOM/setPosition";

/**
 * Toolbar 重构版本
 * 逻辑已拆分至各个独立模块
 */
// S-forge: 模块化重构 - 将原始内联实现拆分到独立子模块（setInlineMark, renderPanel, showRender/, inlineMark/, showCodeLanguage, showTpl, showWidget, showContent）
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
        if (isMobile) {
            this.subElement.className = "protyle-util fn__none protyle-util--mobile";
        }
        if (!isMobile) {
            this.subElement.className = "protyle-util fn__none";
        }
        this.toolbarHeight = 29;
        for (const item of protyle.app.plugins) {
            const pluginToolbar = item.updateProtyleToolbar(options.toolbar || []);
            for (const toolbarItem of pluginToolbar) {
                if (typeof toolbarItem === "string" || Constants.INLINE_TYPE.concat("|").includes(toolbarItem.name) || !toolbarItem.hotkey) {
                    continue;
                }
                // 插件可能返回非字符串类型的hotkey（如数字或对象），需要规范化为空字符串以避免后续热键匹配出错
                if (typeof toolbarItem.hotkey !== "string") {
                    toolbarItem.hotkey = "";
                }
                const customHotkey = getPluginCustomHotkey(item.name, toolbarItem.name);
                if (customHotkey) {
                    toolbarItem.hotkey = customHotkey;
                }
            }
            options.toolbar = toolbarKeyToMenu(pluginToolbar);
        }
        for (const menuItem of options.toolbar || []) {
            if (!isMenuItem(menuItem)) {
                continue;
            }
            const itemElement = genToolbarItem(protyle, menuItem);
            if (itemElement) {
                this.element.appendChild(itemElement);
            }
        }
    }

    /**
     * 重新构建工具栏菜单项
     * 作用：清空当前工具栏并根据最新的插件配置重新生成所有菜单项
     * 意图：当插件加载/卸载/更新时，工具栏需要同步更新以反映插件提供的自定义工具栏项
     * 调用时机：插件安装、卸载、启用/禁用时，由 plugin/loader.ts、plugin/index.ts、plugin/uninstall.ts 调用
     */
    public update(protyle: IProtyle) {
        this.element.innerHTML = "";
        protyle.options.toolbar = toolbarKeyToMenu(Constants.PROTYLE_TOOLBAR);
        for (const item of protyle.app.plugins) {
            const pluginToolbar = item.updateProtyleToolbar(protyle.options.toolbar);
            for (const toolbarItem of pluginToolbar) {
                if (typeof toolbarItem === "string" || Constants.INLINE_TYPE.concat("|").includes(toolbarItem.name) || !toolbarItem.hotkey) {
                    continue;
                }
                // 插件可能返回非字符串类型的hotkey（如数字或对象），需要规范化为空字符串以避免后续热键匹配出错
                if (typeof toolbarItem.hotkey !== "string") {
                    toolbarItem.hotkey = "";
                }
                const customHotkey = getPluginCustomHotkey(item.name, toolbarItem.name);
                if (customHotkey) {
                    toolbarItem.hotkey = customHotkey;
                }
            }
            protyle.options.toolbar = toolbarKeyToMenu(pluginToolbar);
        }
        for (const menuItem of protyle.options.toolbar) {
            if (!isMenuItem(menuItem)) {
                continue;
            }
            const itemElement = genToolbarItem(protyle, menuItem);
            if (itemElement) {
                this.element.appendChild(itemElement);
            }
        }
    }

    /**
     * 根据当前选区渲染浮动工具栏的显示状态和位置
     * 作用：判断选区是否有效文本，计算工具栏位置并显示/隐藏，同时高亮当前已应用的行内样式按钮
     * 意图：用户选中文本时需要显示浮动工具栏以便快速应用行内格式
     * 调用时机：keyup事件中shift+方向键选中文本时、鼠标选中文本后、表格单元格选中时
     */
    // S-forge: render方法委托给renderToolbar子模块
    public render(protyle: IProtyle, range: Range, event?: KeyboardEvent) {
        this.range = range;
        const result = renderToolbar(protyle, range, event, this.element, (r) => this.range = r);
        if (result) {
            this.range = result.range;
            this.toolbarHeight = result.toolbarHeight;
        }
    }

    /**
     * 获取当前选区所包含的行内标记类型列表
     * 作用：分析range所在的span元素的data-type属性，返回如 ["bold", "italic"] 等类型数组
     * 意图：供外部判断当前光标/选区位置已应用了哪些行内样式，用于工具栏按钮高亮、粘贴逻辑、回车换行等场景
     * 调用时机：keydown处理、粘贴、插入HTML、表格操作、移动端键盘工具栏、右键菜单等多处调用
     */
    public getCurrentType(range = this.range) {
        if (!range) {
            return [];
        }
        return getRangeTypes(range);
    }

    /**
     * 对当前选区应用或移除行内标记（如加粗、斜体、链接、引用等）
     * 作用：根据type和action参数，在当前range上添加/移除/切换对应的行内span标记
     * 意图：统一的行内标记操作入口，处理各种边界情况（跨块选区、ZWSP、元素切割合并等）
     * 调用时机：工具栏按钮点击、快捷键触发、粘贴链接/引用、hint补全、右键菜单等
     */
    // S-forge: setInlineMark方法委托给setInlineMark子模块（含inlineMark/子目录）
    public setInlineMark(protyle: IProtyle, type: string, action: "range" | "toolbar", textObj?: ITextOption) {
        if (!this.range) {
            return;
        }
        const result = setInlineMark(protyle, type, action, this.range, this.element, textObj);
        // 操作成功且返回了更新后的range时，同步到toolbar实例并返回新插入的节点
        if (result && result.range) {
            this.range = result.range;
            return result.newNodes;
        }
        // 三击后还没有重新纠正 range 时使用快捷键标记会导致异常 https://github.com/siyuan-note/siyuan/issues/7068
        if (nodeElement !== endElement) {
            this.range = setLastNodeRange(getContenteditableElement(nodeElement), this.range, false);
        }

        let rangeTypes: string[] = [];
        this.range.cloneContents().childNodes.forEach((item: HTMLElement) => {
            if (item.nodeType !== 3) {
                rangeTypes = rangeTypes.concat((item.getAttribute("data-type") || "").split(" "));
            }
        });
        let rangeStartNextSibling = hasNextSibling(this.range.startContainer);
        while (rangeStartNextSibling && rangeStartNextSibling.nodeType === 1 && (rangeStartNextSibling as HTMLElement).tagName === "BR") {
            rangeStartNextSibling = hasNextSibling(rangeStartNextSibling);
        }
        const isSameNode = this.range.startContainer === this.range.endContainer ||
            (rangeStartNextSibling && rangeStartNextSibling === this.range.endContainer &&
                this.range.startContainer.parentElement === this.range.endContainer.parentElement);
        if (this.range.startContainer.nodeType === 3 && this.range.startContainer.parentElement.tagName === "SPAN" &&
            isSameNode &&
            this.range.startOffset > -1 && this.range.endOffset <= this.range.endContainer.textContent.length) {
            rangeTypes = rangeTypes.concat((this.range.startContainer.parentElement.getAttribute("data-type") || "").split(" "));
        }
        const selectText = this.range.toString();
        let keepZWPS = false;
        // ctrl+b/u/i  https://github.com/siyuan-note/siyuan/issues/14820
        if (!selectText && this.range.startOffset === 1 && this.range.startContainer.textContent === Constants.ZWSP) {
            let newElement;
            if (this.range.startContainer.nodeType === 1) {
                newElement = this.range.startContainer as HTMLElement;
            } else {
                newElement = this.range.startContainer.parentElement;
            }
            if (newElement.tagName === "SPAN") {
                rangeTypes = rangeTypes.concat((newElement.getAttribute("data-type") || "").split(" "));
                this.range.setStart(newElement.firstChild, 0);
                this.range.setEnd(newElement.lastChild, newElement.lastChild.textContent.length || 0);
                keepZWPS = true;
            }
        }
        if (rangeTypes.length === 1) {
            // https://github.com/siyuan-note/siyuan/issues/6501
            // https://github.com/siyuan-note/siyuan/issues/12877
            if (["block-ref", "virtual-block-ref", "file-annotation-ref", "a", "inline-memo", "inline-math", "tag"].includes(rangeTypes[0]) && type === "clear") {
                return;
            }
        }
        // https://github.com/siyuan-note/siyuan/issues/14534
        if (rangeTypes.includes("text") && type === "text" && textObj && this.range.startContainer.nodeType === 3 && this.range.startContainer === this.range.endContainer) {
            const selectParentElement = this.range.startContainer.parentElement;
            if (selectParentElement && hasSameTextStyle(null, selectParentElement, textObj)) {
                return;
            }
        }
        fixTableRange(this.range);

        let contents;
        let html;
        let needWrapTarget;
        if (this.range.startContainer.nodeType === 3 && this.range.startContainer.parentElement.tagName === "SPAN" &&
            isSameNode) {
            if (this.range.startOffset > -1 && this.range.endOffset <= this.range.endContainer.textContent.length) {
                needWrapTarget = this.range.startContainer.parentElement;
            }
            const startPreviousSibling = hasPreviousSibling(this.range.startContainer);
            const endNextSibling = hasNextSibling(this.range.endContainer);
            if ((
                    this.range.startOffset !== 0 ||
                    // https://github.com/siyuan-note/siyuan/issues/14869
                    (this.range.startOffset === 0 && startPreviousSibling &&
                        (startPreviousSibling.nodeType === 3 || (startPreviousSibling as HTMLElement).tagName === "BR") &&
                        this.range.startContainer.previousSibling.parentElement === this.range.startContainer.parentElement)
                ) && (
                    this.range.endOffset !== this.range.endContainer.textContent.length ||
                    // https://github.com/siyuan-note/siyuan/issues/14869#issuecomment-2911553387
                    (
                        this.range.endOffset === this.range.endContainer.textContent.length && endNextSibling &&
                        (endNextSibling.nodeType === 3 || (endNextSibling as HTMLElement).tagName === "BR") &&
                        this.range.endContainer.nextSibling.parentElement === this.range.endContainer.parentElement
                    )
                ) &&
                !(this.range.startOffset === 1 && this.range.startContainer.textContent.startsWith(Constants.ZWSP))) {
                // 切割元素
                const parentElement = this.range.startContainer.parentElement;
                const afterElement = document.createElement("span");
                const attributes = parentElement.attributes;
                for (let i = 0; i < attributes.length; i++) {
                    afterElement.setAttribute(attributes[i].name, attributes[i].value);
                }
                this.range.insertNode(document.createElement("wbr"));
                html = nodeElement.outerHTML;
                contents = this.range.extractContents();
                this.range.setEnd(parentElement.lastChild, parentElement.lastChild.textContent.length);
                afterElement.append(this.range.extractContents());
                parentElement.after(afterElement);
                this.range.setStartBefore(afterElement);
                this.range.collapse(true);
            }
        }
        let isEndSpan = false;
        // https://github.com/siyuan-note/siyuan/issues/7200
        if (this.range.endOffset === this.range.endContainer.textContent.length &&
            !["DIV", "TD", "TH", "TR"].includes(this.range.endContainer.parentElement.tagName) &&
            !hasNextSibling(this.range.endContainer)) {
            this.range.setEndAfter(this.range.endContainer.parentElement);
            isEndSpan = true;
        }
        if (this.range.startOffset === 0 &&
            !["DIV", "TD", "TH", "TR"].includes(this.range.startContainer.parentElement.tagName) &&
            !hasPreviousSibling(this.range.startContainer)) {
            this.range.setStartBefore(this.range.startContainer.parentElement);
        }
        if (!html) {
            this.range.insertNode(document.createElement("wbr"));
            html = nodeElement.outerHTML;
            contents = this.range.extractContents();
        }
        this.mergeNode(contents.childNodes);
        contents.childNodes.forEach((item: HTMLElement) => {
            if (item.nodeType === 3 && item.textContent === Constants.ZWSP) {
                item.remove();
            }
            if (item.nodeType === 1 && item.textContent === "" && item.tagName === "SPAN") {
                item.remove();
            }
        });
        if (selectText && this.range.startContainer.nodeType !== 3) {
            let emptyNode: Element = this.range.startContainer.childNodes[this.range.startOffset] as HTMLElement;
            if (!emptyNode) {
                emptyNode = this.range.startContainer.childNodes[this.range.startOffset - 1] as HTMLElement;
            }
            if (emptyNode && emptyNode.nodeType === 3) {
                if ((this.range.startContainer as HTMLElement).tagName === "DIV") {
                    emptyNode = emptyNode.previousSibling as HTMLElement;
                } else {
                    emptyNode = this.range.startContainer as HTMLElement;
                }
            }
            if (emptyNode && emptyNode.nodeType !== 3 && emptyNode.textContent.replace(Constants.ZWSP, "") === "" &&
                !["TD", "TH", "BR"].includes(emptyNode.tagName)) {
                emptyNode.remove();
            }
        }
        // 选择 span 中的部分需进行包裹
        if (needWrapTarget) {
            const attributes = needWrapTarget.attributes;
            contents.childNodes.forEach(item => {
                if (item.nodeType === 3) {
                    const spanElement = document.createElement("span");
                    for (let i = 0; i < attributes.length; i++) {
                        spanElement.setAttribute(attributes[i].name, attributes[i].value);
                    }
                    spanElement.innerHTML = item.textContent;
                    item.replaceWith(spanElement);
                }
            });
        }
        const toolbarElement = isMobile() ? document.querySelector("#keyboardToolbar .keyboard__dynamic").nextElementSibling : this.element;
        const actionBtn = action === "toolbar" ? toolbarElement.querySelector(`[data-type="${type}"]`) : undefined;
        const newNodes: Node[] = [];
        let startContainer: Node;
        let endContainer: Node;
        let startOffset: number;
        let endOffset: number;
        if (type === "clear" || actionBtn?.classList.contains("protyle-toolbar__item--current") || (
            action === "range" && rangeTypes.length > 0 && rangeTypes.includes(type) && !textObj
        )) {
            // 移除
            if (type === "clear") {
                toolbarElement.querySelectorAll('[data-type="strong"],[data-type="em"],[data-type="u"],[data-type="s"],[data-type="mark"],[data-type="sup"],[data-type="sub"],[data-type="kbd"],[data-type="mark"],[data-type="code"]').forEach(item => {
                    item.classList.remove("protyle-toolbar__item--current");
                });
            } else if (actionBtn) {
                actionBtn.classList.remove("protyle-toolbar__item--current");
            }
            if (contents.childNodes.length === 0) {
                rangeTypes.find((itemType, index) => {
                    if (type === itemType) {
                        rangeTypes.splice(index, 1);
                        return true;
                    }
                });
                if (rangeTypes.length === 0 || type === "clear") {
                    newNodes.push(document.createTextNode(Constants.ZWSP));
                    startContainer = newNodes[0];
                } else {
                    let removeIndex = 0;
                    while (removeIndex < rangeTypes.length) {
                        if (["inline-memo", "text", "block-ref", "virtual-block-ref", "file-annotation-ref", "a"].includes(rangeTypes[removeIndex])) {
                            rangeTypes.splice(removeIndex, 1);
                        } else {
                            ++removeIndex;
                        }
                    }
                    const inlineElement = document.createElement("span");
                    inlineElement.setAttribute("data-type", rangeTypes.join(" "));
                    inlineElement.textContent = Constants.ZWSP;
                    newNodes.push(inlineElement);
                    startContainer = newNodes[0].firstChild;
                }
                keepZWPS = true;
                startOffset = 1;
            }
            contents.childNodes.forEach((item: HTMLElement) => {
                if (item.nodeType !== 3 && item.tagName !== "BR" && item.tagName !== "IMG" && !item.classList.contains("img")) {
                    const types = (item.getAttribute("data-type") || "").split(" ");
                    if (type === "clear") {
                        for (let i = 0; i < types.length; i++) {
                            if (textObj && textObj.type === "text") {
                                if ("text" === types[i]) {
                                    types.splice(i, 1);
                                    i--;
                                }
                            } else {
                                if (["kbd", "text", "strong", "em", "u", "s", "mark", "sup", "sub", "code"].includes(types[i])) {
                                    types.splice(i, 1);
                                    i--;
                                }
                            }
                        }
                    } else {
                        types.find((itemType, typeIndex) => {
                            if (type === itemType) {
                                types.splice(typeIndex, 1);
                                return true;
                            }
                        });
                    }
                    if (types.length === 0) {
                        newNodes.push(document.createTextNode(item.textContent));
                    } else {
                        if (type === "clear") {
                            item.style.color = "";
                            item.style.webkitTextFillColor = "";
                            item.style.webkitTextStroke = "";
                            item.style.textShadow = "";
                            item.style.backgroundColor = "";
                            item.style.fontSize = "";
                        }
                        item.setAttribute("data-type", types.join(" "));
                        newNodes.push(item);
                    }
                } else {
                    newNodes.push(item);
                }
            });
        } else {
            // 添加
            if (!this.element.classList.contains("fn__none") && type !== "text" && actionBtn) {
                actionBtn.classList.add("protyle-toolbar__item--current");
            }
            if (selectText === "") {
                const inlineElement = document.createElement("span");
                rangeTypes.push(type);

                // 遇到以下类型结尾不应继承 https://github.com/siyuan-note/siyuan/issues/7200
                if (isEndSpan) {
                    let removeIndex = 0;
                    while (removeIndex < rangeTypes.length) {
                        if (["inline-memo", "text", "block-ref", "virtual-block-ref", "file-annotation-ref", "a"].includes(rangeTypes[removeIndex])) {
                            rangeTypes.splice(removeIndex, 1);
                        } else {
                            ++removeIndex;
                        }
                    }
                    // https://github.com/siyuan-note/siyuan/issues/14421
                    if (rangeTypes.length === 0) {
                        rangeTypes.push(type);
                    }
                }
                inlineElement.setAttribute("data-type", [...new Set(rangeTypes)].join(" "));
                inlineElement.textContent = Constants.ZWSP;
                setFontStyle(inlineElement, textObj);
                newNodes.push(inlineElement);
                keepZWPS = true;
            } else {
                // https://github.com/siyuan-note/siyuan/issues/7477
                // https://github.com/siyuan-note/siyuan/issues/8825
                if (type === "block-ref") {
                    while (contents.childNodes.length > 1) {
                        contents.childNodes[0].remove();
                    }
                }
                contents.childNodes.forEach((item: HTMLElement) => {
                    let removeText = "";
                    if (item.nodeType === 3 && item.textContent) {
                        // https://github.com/siyuan-note/siyuan/issues/14204
                        while (item.textContent.endsWith("\n")) {
                            item.textContent = item.textContent.substring(0, item.textContent.length - 1);
                            removeText += "\n";
                        }
                        if (item.textContent) {
                            const inlineElement = document.createElement("span");
                            inlineElement.setAttribute("data-type", type);
                            inlineElement.textContent = item.textContent;
                            if (type === "a") {
                                if (!inlineElement.textContent) {
                                    inlineElement.textContent = "*";
                                }
                                textObj.color = textObj.color.split(Constants.ZWSP)[0];
                            }
                            setFontStyle(inlineElement, textObj);

                            if (type === "text" && !inlineElement.getAttribute("style")) {
                                newNodes.push(item);
                            } else {
                                newNodes.push(inlineElement);
                            }
                        }
                    } else if (item.nodeType === 1) {
                        let types = (item.getAttribute("data-type") || "").split(" ");
                        for (let i = 0; i < types.length; i++) {
                            // "backslash", "virtual-block-ref", "search-mark" 只能单独存在
                            if (["backslash", "virtual-block-ref", "search-mark"].includes(types[i])) {
                                types.splice(i, 1);
                                i--;
                            }
                        }
                        if (!types.includes("img")) {
                            types.push(type);
                        }
                        // 上标和下标不能同时存在 https://github.com/siyuan-note/insider/issues/1049
                        if (type === "sub" && types.includes("sup")) {
                            types.find((item, index) => {
                                if (item === "sup") {
                                    types.splice(index, 1);
                                    toolbarElement.querySelector('[data-type="sup"]').classList.remove("protyle-toolbar__item--current");
                                    return true;
                                }
                            });
                        } else if (type === "sup" && types.includes("sub")) {
                            types.find((item, index) => {
                                if (item === "sub") {
                                    types.splice(index, 1);
                                    toolbarElement.querySelector('[data-type="sub"]').classList.remove("protyle-toolbar__item--current");
                                    return true;
                                }
                            });
                        } else if (type === "block-ref" && (types.includes("a") || types.includes("file-annotation-ref"))) {
                            // 虚拟引用和链接/标注不能同时存在
                            types.find((item, index) => {
                                if (item === "a" || item === "file-annotation-ref") {
                                    types.splice(index, 1);
                                    return true;
                                }
                            });
                        } else if (type === "a" && (types.includes("block-ref") || types.includes("file-annotation-ref"))) {
                            // 链接和引用/标注不能同时存在
                            types.find((item, index) => {
                                if (item === "block-ref" || item === "file-annotation-ref") {
                                    types.splice(index, 1);
                                    return true;
                                }
                            });
                        } else if (type === "file-annotation-ref" && (types.includes("block-ref") || types.includes("a"))) {
                            // 引用和链接/标注不能同时存在
                            types.find((item, index) => {
                                if (item === "block-ref" || item === "a") {
                                    types.splice(index, 1);
                                    return true;
                                }
                            });
                        } else if (type === "inline-memo" && types.includes("inline-math")) {
                            // 数学公式和备注不能同时存在
                            types.find((item, index) => {
                                if (item === "inline-math") {
                                    types.splice(index, 1);
                                    return true;
                                }
                            });
                            if (item.querySelector(".katex")) {
                                // 选中完整的数学公式才进行备注 https://github.com/siyuan-note/siyuan/issues/13667
                                item.textContent = item.getAttribute("data-content");
                            }
                        } else if (type === "inline-math" && types.includes("inline-memo")) {
                            // 数学公式和备注不能同时存在
                            types.find((item, index) => {
                                if (item === "inline-memo") {
                                    types.splice(index, 1);
                                    return true;
                                }
                            });
                        }
                        types = [...new Set(types)];
                        if (item.tagName !== "BR" && item.tagName !== "IMG" && !types.includes("img")) {
                            item.setAttribute("data-type", types.join(" "));
                            if (type === "a") {
                                if (!item.textContent) {
                                    item.textContent = "*";
                                }
                                textObj.color = textObj.color.split(Constants.ZWSP)[0];
                            }
                            setFontStyle(item, textObj);
                            if (types.includes("text") && !item.getAttribute("style")) {
                                if (types.length === 1) {
                                    const tempText = document.createTextNode(item.textContent);
                                    newNodes.push(tempText);
                                } else {
                                    types.splice(types.indexOf("text"), 1);
                                    item.setAttribute("data-type", types.join(" "));
                                    newNodes.push(item);
                                }
                            } else {
                                newNodes.push(item);
                            }
                        } else {
                            newNodes.push(item);
                        }
                    }
                    if (removeText) {
                        newNodes.push(document.createTextNode(removeText));
                    }
                });
            }
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
            for (let i = 0; i <= newNodes.length; i++) {
                let previousElement = i === newNodes.length ? newNodes[i - 1] as HTMLElement : hasPreviousSibling(newNodes[i]) as HTMLElement;
                if (previousElement.nodeType === 3 && previousElement.textContent === Constants.ZWSP) {
                    previousElement = hasPreviousSibling(previousElement) as HTMLElement;
                    if (previousElement) {
                        previousElement.nextSibling.remove();
                    }
                }
                let currentNode = newNodes[i] as HTMLElement;
                if (!currentNode) {
                    currentNode = hasNextSibling(newNodes[i - 1]) as HTMLElement;
                    if (currentNode && currentNode.nodeType === 3 && currentNode.textContent === Constants.ZWSP) {
                        currentNode = hasNextSibling(currentNode) as HTMLElement;
                        if (currentNode) {
                            currentNode.previousSibling.remove();
                        }
                    }
                }
                if (currentNode && currentNode.nodeType !== 3) {
                    const currentType = (currentNode.getAttribute("data-type") || "").split(" ");
                    if (currentNode.tagName !== "BR" && !currentNode.classList.contains("img") &&
                        previousElement && previousElement.nodeType !== 3 &&
                        currentNode.nodeType !== 3 &&
                        isArrayEqual(currentType, (previousElement.getAttribute("data-type") || "").split(" ")) &&
                        hasSameTextStyle(currentNode, previousElement)) {
                        if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
                            if (currentNode.textContent.startsWith(Constants.ZWSP)) {
                                currentNode.textContent = currentNode.textContent.substring(1);
                            }
                        }
                        if (currentType.includes("inline-math")) {
                            // 数学公式合并 data-content https://github.com/siyuan-note/siyuan/issues/6028
                            currentNode.setAttribute("data-content", previousElement.getAttribute("data-content") + currentNode.getAttribute("data-content"));
                        } else if (currentType.includes("block-ref") && previousElement.getAttribute("data-id") === currentNode.getAttribute("data-id")) {
                            if (previousElement.dataset.subtype !== "d" || previousElement.dataset.subtype !== "d") {
                                currentNode.setAttribute("data-subtype", "s");
                                currentNode.textContent = previousElement.textContent + currentNode.textContent;
                            }
                        } else {
                            // 测试不存在 https://ld246.com/article/1664454663564 情况，故移除引用合并限制
                            // 搜索结果引用被高亮隔断需进行合并 https://github.com/siyuan-note/siyuan/issues/7588
                            // textContent：防止赋值后 \n 转换为 br 导致后续 this.range.setStart 报错；innerText：获取 br 的 \n， https://github.com/siyuan-note/siyuan/issues/15968
                            currentNode.textContent = previousElement.innerText + currentNode.innerText;
                            // 如果为备注时，合并备注内容
                            if (currentType.includes("inline-memo")) {
                                currentNode.setAttribute("data-inline-memo-content", (previousElement.getAttribute("data-inline-memo-content") || "") +
                                    (currentNode.getAttribute("data-inline-memo-content") || ""));
                            }
                        }
                        if (!currentType.includes("inline-math")) {
                            if (i === 0) {
                                startContainer = currentNode;
                                startOffset = previousElement.textContent.length;
                            } else if (i === newNodes.length) {
                                endContainer = currentNode;
                                endOffset = previousElement.textContent.length;
                                if (!startContainer) {
                                    startContainer = currentNode;
                                } else if (startContainer === previousElement) {
                                    startContainer = currentNode;
                                }
                            }
                        }
                        previousElement.remove();
                        if (i > 0) {
                            newNodes.splice(i - 1, 1);
                            i--;
                        }
                        if (newNodes.length === 0) {
                            newNodes.push(currentNode);
                            break;
                        }
                    }
                }
            }
            // 整理 zwsp
            for (let i = 0; i <= newNodes.length; i++) {
                const previousElement = i === newNodes.length ? newNodes[i - 1] as HTMLElement : hasPreviousSibling(newNodes[i]) as HTMLElement;
                let currentNode = newNodes[i] as HTMLElement;
                if (!currentNode) {
                    currentNode = hasNextSibling(newNodes[i - 1]) as HTMLElement;
                }
                if (!currentNode) {
                    if (previousElement.nodeType !== 3) {
                        const currentType = (previousElement.getAttribute("data-type") || "").split(" ");
                        if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
                            previousElement.insertAdjacentText("afterend", Constants.ZWSP);
                        }
                    }
                    break;
                }
                if (currentNode.nodeType === 3) {
                    if (previousElement && previousElement.nodeType === 3) {
                        if (currentNode.textContent.startsWith(Constants.ZWSP)) {
                            currentNode.textContent = currentNode.textContent.substring(1);
                        }
                        if (previousElement.textContent.endsWith(Constants.ZWSP)) {
                            previousElement.textContent = previousElement.textContent.substring(0, previousElement.textContent.length - 1);
                        }
                    } else {
                        const previousType = previousElement ? (previousElement.getAttribute("data-type") || "").split(" ") : [];
                        if (previousType.includes("code") || previousType.includes("tag") || previousType.includes("kbd")) {
                            if (!currentNode.textContent.startsWith(Constants.ZWSP)) {
                                currentNode.textContent = Constants.ZWSP + currentNode.textContent;
                            }
                        } else if (currentNode.textContent.startsWith(Constants.ZWSP)) {
                            currentNode.textContent = currentNode.textContent.substring(1);
                        }
                    }
                } else {
                    const currentType = currentNode.nodeType === 3 ? [] : (currentNode.getAttribute("data-type") || "").split(" ");
                    if (currentType.includes("code") || currentType.includes("tag") || currentType.includes("kbd")) {
                        if (!currentNode.textContent.startsWith(Constants.ZWSP)) {
                            currentNode.insertAdjacentText("afterbegin", Constants.ZWSP);
                        }
                        if (!previousElement || (previousElement.nodeType === 3 && previousElement.textContent.endsWith("\n"))) {
                            currentNode.insertAdjacentText("beforebegin", Constants.ZWSP);
                        }
                    } else if (currentNode.textContent.startsWith(Constants.ZWSP)) {
                        currentNode.textContent = currentNode.textContent.substring(1);
                    }
                    if (previousElement && previousElement.nodeType !== 3) {
                        const previousType = (previousElement.getAttribute("data-type") || "").split(" ");
                        if (previousType.includes("code") || previousType.includes("tag") || previousType.includes("kbd")) {
                            currentNode.insertAdjacentText("beforebegin", Constants.ZWSP);
                        }
                    }
                }
            }
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

        const showMenuElement = newNodes[0] as HTMLElement;
        if (showMenuElement.nodeType !== 3) {
            const showMenuTypes = (showMenuElement.getAttribute("data-type") || "").split(" ");
            if (type === "inline-math") {
                mathRender(nodeElement);
                if (selectText === "" && showMenuTypes.includes("inline-math")) {
                    protyle.toolbar.showRender(protyle, showMenuElement, undefined, html);
                }
            } else if (type === "inline-memo") {
                if (!showMenuElement.getAttribute("data-inline-memo-content") &&
                    showMenuTypes.includes("inline-memo")) {
                    protyle.toolbar.showRender(protyle, showMenuElement, newNodes as Element[], html);
                }
            } else if (type === "a") {
                if (showMenuTypes.includes("a") &&
                    (showMenuElement.textContent.replace(Constants.ZWSP, "") === "" || !showMenuElement.getAttribute("data-href"))) {
                    linkMenu(protyle, showMenuElement, showMenuElement.getAttribute("data-href") ? true : false);
                }
            }
        }
        return newNodes;
    }

    /**
     * 显示渲染元素的编辑面板（代码块、数学公式、HTML块、行内备注、嵌入块等）
     * 作用：弹出subElement面板，展示文本编辑区域，支持实时预览、固定/取消固定、导出图片等操作
     * 意图：为不可直接编辑的渲染块提供源码编辑入口
     * 调用时机：点击代码块/数学公式/HTML块、回车进入渲染块、输入触发渲染、行内备注编辑、gutter菜单等
     */
    // S-forge: showRender方法委托给renderPanel子模块（含showRender/子目录）
    public showRender(protyle: IProtyle, renderElement: Element, updateElements?: Element[], oldHTML?: string) {
        showRender(
            protyle,
            renderElement,
            updateElements,
            oldHTML,
            this.subElement,
            this.element,
            this.range,
            (cb) => {
                this.subElementCloseCB = cb;
            }
        );
    }

    /**
     * 显示代码块语言选择面板
     * 作用：弹出语言列表供用户选择代码块的编程语言，选择后更新代码块的语言标记
     * 意图：让用户可以快速切换代码块的语法高亮语言
     * 调用时机：点击代码块左上角的语言标签时（wysiwyg/index.ts 中的点击事件处理）
     */
    // S-forge: showCodeLanguage方法委托给showCodeLanguage子模块
    public showCodeLanguage(protyle: IProtyle, languageElements: HTMLElement[]) {
        显示代码语言选择(protyle, languageElements, this.subElement, this.element, (range: Range) => {
            this.range = range;
        }, (languageElements, protyle, selectedLang) => {
            // 仅在range有效且用户确实选择了语言时才执行更新，避免取消选择时的无效操作
            if (this.range && selectedLang !== null) {
                updateLanguage(protyle, languageElements, selectedLang, this.subElement, this.range);
            }
        });
        return;
    }

    public showMultiSelectMode(protyle: IProtyle, blockElement: HTMLElement) {
        blockElement.classList.add("protyle-wysiwyg--select");
        window.siyuan.menus.menu.remove();

        this.subElement.style.width = window.innerWidth - 16 + "px";
        this.subElement.style.padding = "0";
        this.subElement.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>
        <span class="multiSelectCount">${protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select").length}</span>
    </div>
    <span class="fn__flex-1"></span>
    <button class="block__icon block__icon--show" data-type="menu" data-menu="true"><svg><use xlink:href="#iconMore"></use></svg></button>
    <span class="fn__space"></span>
    <button class="block__icon block__icon--show" data-type="exitMultiSelectMode"><svg><use xlink:href="#iconClose"></use></svg></button>
</div>`;
        this.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
        this.subElement.classList.remove("fn__none");
        this.subElementCloseCB = undefined;
        this.subElement.firstElementChild.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && target !== this.subElement) {
                if (target.dataset.type === "exitMultiSelectMode") {
                    this.subElement.classList.add("fn__none");
                    this.subElement.innerHTML = "";
                    hideElements(["select"], protyle);
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                } else if (target.dataset.type === "menu") {
                    protyle.gutter.renderMenu(protyle, protyle.wysiwyg.element.querySelector(".protyle-wysiwyg--select"));
                    window.siyuan.menus.menu.fullscreen();
                    event.preventDefault();
                    event.stopPropagation();
                    break;
                }
                target = target.parentElement;
            }
        });
        setPosition(this.subElement, 8, 8);
        this.element.classList.add("fn__none");
        activeBlur();
    }

    public isMultiSelectMode() {
        let result = false;
        /// #if MOBILE
        result = !this.subElement.classList.contains("fn__none") &&
            !!this.subElement.querySelector('[data-type="exitMultiSelectMode"]');
        /// #endif
        return result;
    }

    /**
     * 显示模板选择面板
     * 作用：弹出模板列表供用户选择并插入预定义的内容模板
     * 意图：通过 `/模板` 斜杠命令触发，提供快速插入模板内容的能力
     * 调用时机：hint补全中输入模板触发词时（hint/index.ts）
     */
    // S-forge: showTpl方法委托给showTpl子模块
    public showTpl(protyle: IProtyle, nodeElement: HTMLElement, range: Range) {
        显示模板选择(protyle, nodeElement, range, this.subElement, this.element, (range: Range) => {
            this.range = range;
        });
    }

    /**
     * 显示挂件选择面板
     * 作用：弹出挂件列表供用户选择并插入挂件块
     * 意图：通过 `/挂件` 斜杠命令触发，提供快速插入挂件的能力
     * 调用时机：hint补全中输入挂件触发词时（hint/index.ts）
     */
    // S-forge: showWidget方法委托给showWidget子模块
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

    /**
     * 显示内容操作面板（移动端专用）
     * 作用：在移动端显示针对选中内容的操作面板，提供格式化、复制、删除等操作
     * 意图：移动端没有右键菜单，需要通过专门的面板提供内容操作入口
     * 调用时机：移动端选中文本后触发（menus/protyle.ts 中的移动端分支）
     */
    // S-forge: showContent方法委托给showContent子模块
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
}
