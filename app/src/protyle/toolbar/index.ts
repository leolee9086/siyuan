import {Constants} from "../../constants";
import {toolbarKeyToMenu} from "./util";
import {genToolbarItem} from "./ToolbarItemFactory";
import {updateLanguage} from "./updateLanguage";
import {showRender} from "./renderPanel";
import {setInlineMark} from "./setInlineMark";
import {renderToolbar, getRangeTypes} from "./renderToolbar";
import {显示挂件选择} from "./showWidget";
import {显示内容操作} from "./showContent";
import {显示代码语言选择} from "./showCodeLanguage";
import {显示模板选择} from "./showTpl";
import {isMenuItem} from "./index.guard";
import {getPluginCustomHotkey} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {isMobile} from "../../platform";
import {activeBlur} from "../../mobile/util/keyboardToolbar";
import {hideElements} from "../ui/hideElements";
import {setPosition} from "../../util/DOM/setPosition";
const getDefaultToolbar = () => toolbarKeyToMenu(isMobile ? [
    "block-ref",
    "a",
    "|",
    "text",
    "strong",
    "em",
    "u",
    "clear",
    "|",
    "code",
    "tag",
    "inline-math",
    "inline-memo",
] : [
    "block-ref",
    "a",
    "|",
    "text",
    "strong",
    "em",
    "u",
    "s",
    "mark",
    "sup",
    "sub",
    "clear",
    "|",
    "code",
    "kbd",
    "tag",
    "inline-math",
    "inline-memo",
]);

const renderMultiSelectMenu = (protyle: IProtyle, wysiwygElement: HTMLElement) => {
    const selectedElement = wysiwygElement.querySelector(".protyle-wysiwyg--select");
    if (!selectedElement || !protyle.gutter) {
        return;
    }
    protyle.gutter.renderMenu(protyle, selectedElement);
};

const handleMultiSelectModeClick = (
    event: Event,
    protyle: IProtyle,
    subElement: HTMLElement,
    wysiwygElement: HTMLElement,
    menu: {fullscreen: () => void}
) => {
    let target = event.target;
    while (target instanceof HTMLElement && target !== subElement) {
        if (target.dataset.type === "exitMultiSelectMode") {
            subElement.classList.add("fn__none");
            subElement.innerHTML = "";
            hideElements(["select"], protyle);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (target.dataset.type === "menu") {
            renderMultiSelectMenu(protyle, wysiwygElement);
            menu.fullscreen();
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        target = target.parentElement;
    }
};

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
        protyle.options.toolbar = getDefaultToolbar();
        for (const item of protyle.app.plugins) {
            const pluginToolbar = item.updateProtyleToolbar(protyle.options.toolbar);
            for (const toolbarItem of pluginToolbar) {
                if (typeof toolbarItem === "string" || Constants.INLINE_TYPE.concat("|").includes(toolbarItem.name) || !toolbarItem.hotkey) {
                    continue;
                }
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
        if (result && result.range) {
            this.range = result.range;
            return result.newNodes;
        }
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
            if (this.range && selectedLang !== null) {
                updateLanguage(protyle, languageElements, selectedLang, this.subElement, this.range);
            }
        });
    }

    public showMultiSelectMode(protyle: IProtyle, blockElement: HTMLElement) {
        const wysiwygElement = protyle.wysiwyg?.element;
        const menu = window.siyuan.menus?.menu;
        if (!wysiwygElement || !menu) {
            return;
        }
        blockElement.classList.add("protyle-wysiwyg--select");
        menu.remove();

        this.subElement.style.width = window.innerWidth - 16 + "px";
        this.subElement.style.padding = "0";
        this.subElement.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>
        <span class="multiSelectCount">${wysiwygElement.querySelectorAll(".protyle-wysiwyg--select").length}</span>
    </div>
    <span class="fn__flex-1"></span>
    <button class="block__icon block__icon--show" data-type="menu" data-menu="true"><svg><use xlink:href="#iconMore"></use></svg></button>
    <span class="fn__space"></span>
    <button class="block__icon block__icon--show" data-type="exitMultiSelectMode"><svg><use xlink:href="#iconClose"></use></svg></button>
</div>`;
        this.subElement.style.zIndex = (++window.siyuan.zIndex).toString();
        this.subElement.classList.remove("fn__none");
        this.subElementCloseCB = undefined;
        this.subElement.firstElementChild?.addEventListener("click", (event) => {
            handleMultiSelectModeClick(event, protyle, this.subElement, wysiwygElement, menu);
        });
        setPosition(this.subElement, 8, 8);
        this.element.classList.add("fn__none");
        activeBlur();
    }

    public isMultiSelectMode() {
        if (!isMobile) {
            return false;
        }
        return !this.subElement.classList.contains("fn__none") &&
            !!this.subElement.querySelector('[data-type="exitMultiSelectMode"]');
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
