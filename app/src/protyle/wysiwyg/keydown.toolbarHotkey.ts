import { matchHotKey } from "../util/hotKey";
import { Constants } from "../../constants";
import { isInEmbedBlock } from "../util/hasClosest";
import { fontEvent } from "../toolbar/Font";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 工具栏快捷键中间件
 * 处理工具栏相关的快捷键操作
 */
export const toolbarHotkeyMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (nodeElement.classList.contains("code-block") || event.repeat || isInEmbedBlock(nodeElement)) {
        return;
    }

    let findToolbar = false;
    if (protyle.options?.toolbar) {
        protyle.options.toolbar.find((menuItem: IMenuItem | string) => {
            if (typeof menuItem === "string") {
                return false;
            }
            if (!menuItem.hotkey) {
                return false;
            }
            if (matchHotKey(menuItem.hotkey, event)) {
                // 设置 lastHTMLs 会导致  protyle.toolbar.range 和 range 不一致，需重置一下 https://github.com/siyuan-note/siyuan/issues/10933
                if (protyle.toolbar) {
                    protyle.toolbar.range = range;
                    if (["block-ref"].includes(menuItem.name) && protyle.toolbar.range.toString() === "") {
                        return true;
                    }
                }
                findToolbar = true;
                if (["a", "block-ref", "inline-math", "inline-memo", "text"].includes(menuItem.name)) {
                    const toolbarElement = protyle.toolbar?.element?.querySelector(`[data-type="${menuItem.name}"]`);
                    if (toolbarElement) {
                        toolbarElement.dispatchEvent(new CustomEvent("click"));
                    }
                } else if (Constants.INLINE_TYPE.includes(menuItem.name)) {
                    if (protyle.toolbar) {
                        protyle.toolbar.setInlineMark(protyle, menuItem.name, "range");
                    }
                } else if (menuItem.click) {
                    menuItem.click(protyle.getInstance());
                }
                return true;
            }
        });
    }

    if (findToolbar) {
        event.preventDefault();
        event.stopPropagation();
        if (protyle.wysiwyg) {
            protyle.wysiwyg.preventKeyup = true;
        }
        controller.abort("工具栏快捷键处理");
    }
};


export const toolbarLastUsedMiddleware = (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (matchHotKey(getSiyuanConfig().keymap.editor.insert.lastUsed.custom, event)) {

        if (!protyle.toolbar) {
            throw new Error("protyle缺少toolbar属性");
        }
        if (!protyle.wysiwyg) {
            throw new Error("protyle缺少wysiwyg属性");
        }
        const selectText = range.toString();
        protyle.toolbar.range = range;
        const selectElements: Element[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
        if (selectText === "" && selectElements.length === 0) {
            selectElements.push(nodeElement);
        }
        fontEvent(protyle, selectElements);
        event.stopPropagation();
        event.preventDefault();
        controller.abort("最近使用字体快捷键");
        return;
    }
};