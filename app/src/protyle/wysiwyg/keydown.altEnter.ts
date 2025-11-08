import { matchHotKey } from "../util/hotKey";
import { addSubList } from "./list.addSubList";
import { isIncludesHotKey } from "../util/hotKey";

/**
 * Alt+Enter 快捷键中间件
 * 处理代码块语言选择和子列表添加功能
 * @param event 键盘事件
 * @param protyle Protyle 实例
 * @param nodeElement 当前块元素
 * @param selectText 选中的文本
 * @returns 如果处理了事件返回 true，否则返回 false
 */
export const altEnterMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
)=> {
    const selectText = range.toString()
    // 检查是否匹配 Alt+Enter 快捷键且没有选中文本
    if (matchHotKey("⌥↩", event) && selectText === "") {
        const selectElements = Array.from(protyle.wysiwyg?.element?.querySelectorAll(".protyle-wysiwyg--select") || []);
        if (selectElements.length === 0) {
            selectElements.push(nodeElement);
        }
        if (selectElements.length > 0 && !isIncludesHotKey("⌥↩")) {
            const otherElement = selectElements.find(item => {
                return !item.classList.contains("code-block");
            });
            if (!otherElement) {
                // 所有选中的都是代码块，显示代码语言选择器
                const languageElements: HTMLElement[] = [];
                selectElements.forEach(item => {
                    const langElement = item.querySelector(".protyle-action__language");
                    if (langElement instanceof HTMLElement) {
                        languageElements.push(langElement);
                    }
                });
                protyle.toolbar?.showCodeLanguage(protyle, languageElements);
            } else {
                // 不全是代码块，添加子列表
                addSubList(protyle, nodeElement, range);
            }
            event.stopPropagation();
            event.preventDefault();
            controller.abort()
            return 
        }
    }
    return ;
};