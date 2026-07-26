/** 用途：按属性定位编辑宿主；使用范围：可输入元素判断；解耦评估：经键盘子域 imports 访问稳定 DOM 查询。 */
import {hasClosestByAttribute} from "./imports";
/** 用途：按类名定位编辑区；使用范围：可输入元素判断；解耦评估：经键盘子域 imports 访问稳定 DOM 查询。 */
import {hasClosestByClassName} from "./imports";
/** 用途：访问统一键盘生命周期状态；使用范围：原生键盘关闭锁；解耦评估：跨调用状态由注册表拥有。 */
import {getMobileKeyboardLifecycleState} from "./MobileKeyboardLifecycleRegistry";

/** 在主动唤起键盘后设置关闭锁，避免 resize 紧接着关闭键盘。 @同步豁免: 生命周期 */
export const armKeyboardLock = () => {
    getMobileKeyboardLifecycleState().lockUntil = Date.now() + 500;
};

/** 唤起原生移动键盘并先设置关闭锁，由编辑器和 AV 输入动作调用。 @同步豁免: 需要绝对同步的DOM访问 */
export const callMobileAppShowKeyboard = () => {
    armKeyboardLock();

    const androidShowKeyboard = window.JSAndroid?.showKeyboard;
    const harmonyShowKeyboard = window.JSHarmony?.showKeyboard;
    if (androidShowKeyboard) {
        androidShowKeyboard.call(window.JSAndroid);
    }
    // Android 桥不存在时才调用 Harmony，保持原平台优先级。
    if (!androidShowKeyboard && harmonyShowKeyboard) {
        harmonyShowKeyboard.call(window.JSHarmony);
    }
};

/** 判断元素是否为当前允许输入的原生控件或可编辑 Protyle 内容。 @同步豁免: 需要绝对同步的DOM访问 */
export const canInput = (element: Element) => {
    if (!element || element.nodeType !== 1) {
        return false;
    }
    const inputType = element.getAttribute("type") ?? "";
    if ((
        element.tagName === "TEXTAREA" ||
        (element.tagName === "INPUT" && /^(email|number|password|search|tel|text|url)?$/.test(inputType))
    ) && element.getAttribute("readonly") !== "readonly") {
        return element;
    }
    const wysiwygElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
    if (wysiwygElement && wysiwygElement.getAttribute("data-readonly") === "false") {
        return hasClosestByAttribute(element, "contenteditable", "true");
    }
    return false;
};

/** 恢复原生 WebView 焦点能力，供 iframe 交互完成后同步宿主状态。 @同步豁免: 需要绝对同步的DOM访问 */
export const setWebViewFocusable = () => {
    if (!(window.JSAndroid || window.JSHarmony) || document.activeElement?.tagName !== "IFRAME") {
        return;
    }
    // Android 宿主存在时优先恢复其 WebView 焦点能力。
    if (window.JSAndroid?.setWebViewFocusable) {
        window.JSAndroid.setWebViewFocusable(true);
        return;
    }
    // Android 未处理时再交由 Harmony 宿主恢复焦点能力。
    if (window.JSHarmony?.setWebViewFocusable) {
        window.JSHarmony.setWebViewFocusable(true);
    }
};
