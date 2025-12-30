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

/**
 * Toolbar 重构版本
 * 逻辑已拆分至各个独立模块
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

    public render(protyle: IProtyle, range: Range, event?: KeyboardEvent) {
        this.range = range;
        const result = renderToolbar(protyle, range, event, this.element, (r) => this.range = r);
        if (result) {
            this.range = result.range;
            this.toolbarHeight = result.toolbarHeight;
        }
    }

    public getCurrentType(range = this.range) {
        if (!range) {
            return [];
        }
        return getRangeTypes(range);
    }

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

    public showCodeLanguage(protyle: IProtyle, languageElements: HTMLElement[]) {
        显示代码语言选择(protyle, languageElements, this.subElement, this.element, (range: Range) => {
            this.range = range;
        }, (languageElements, protyle, selectedLang) => {
            if (this.range && selectedLang !== null) {
                updateLanguage(protyle, languageElements, selectedLang, this.subElement, this.range);
            }
        });
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
}
