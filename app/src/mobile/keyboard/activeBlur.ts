/** 用途：读取键盘关闭锁；使用范围：原生键盘失焦入口；解耦评估：跨调用状态由统一注册表拥有。 */
import {getMobileKeyboardLifecycleState} from "./MobileKeyboardLifecycleRegistry";
/** 用途：隐藏工具栏唯一实现；使用范围：原生键盘关闭后同步 UI；解耦评估：同一生命周期子域的单向依赖。 */
import {hideKeyboardToolbar} from "./hideKeyboardToolbar";

/** 关闭原生键盘和工具栏并让当前元素失焦；锁定期保持既有阻断与可见警告。 @同步豁免: 需要绝对同步的DOM访问 */
export const activeBlur = () => {
    const lockUntil = getMobileKeyboardLifecycleState().lockUntil;
    const now = Date.now();
    // 主动唤起键盘后的保护期内保持键盘开启，并输出剩余锁定时间供诊断。
    if (now < lockUntil) {
        console.warn(`activeBlur blocked by lock (remaining: ${lockUntil - now}ms)`);
        return;
    }

    const androidHideKeyboard = window.JSAndroid?.hideKeyboard;
    const harmonyHideKeyboard = window.JSHarmony?.hideKeyboard;
    if (androidHideKeyboard) {
        androidHideKeyboard.call(window.JSAndroid);
    }
    // Android 桥不存在时才调用 Harmony，保持原平台优先级。
    if (!androidHideKeyboard && harmonyHideKeyboard) {
        harmonyHideKeyboard.call(window.JSHarmony);
    }
    hideKeyboardToolbar();
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
        throw new Error("Active mobile keyboard element is not an HTMLElement");
    }
    activeElement.blur();
};
