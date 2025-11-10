import { hideElements } from "../ui/hideElements";
/**
 * 普通的各种键盘事件时,将keyup事件设置为放行
 * @param event 
 * @param protyle 
 */
export const setProtyleWysiwygPreventKeyupMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    protyle.wysiwyg && (protyle.wysiwyg.preventKeyup = false);
}
/**
 * 隐藏protyle的工具容器
 * @param event 
 * @param protyle 
 */
export const hideProtyleUtilMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    hideElements(["util"], protyle);
}

/**
 * 隐藏protyle的工具栏,连续按下箭头选择时
 * 为了防抖不要隐藏
 * @param event 
 * @param protyle 
 */
export const hideProtyleToolbarMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (event.shiftKey && event.key.indexOf("Arrow") > -1) {
        // 防止连续选中的时候抖动 https://github.com/siyuan-note/insider/issues/657#issuecomment-851391217
    } else if (!event.repeat && event.code !== "") { // 悬浮工具会触发但 code 为空 https://github.com/siyuan-note/siyuan/issues/6573
        hideElements(["toolbar"], protyle);
    }
}