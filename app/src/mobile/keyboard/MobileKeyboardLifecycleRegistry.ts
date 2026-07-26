/** 用途：统一状态读取；使用范围：键盘生命周期注册表；解耦评估：经本域 imports 暴露基础设施。 */
import {getSForgeState} from "./imports";
/** 用途：统一状态写入；使用范围：键盘生命周期初始化与重置；解耦评估：经本域 imports 暴露基础设施。 */
import {setSForgeState} from "./imports";
/** 用途：生命周期注册表厂牌键；使用范围：唯一状态槽；解耦评估：独立 Symbol 保持精确映射。 */
import {MOBILE_KEYBOARD_LIFECYCLE_REGISTRY} from "./imports";
/** 用途：完整键盘生命周期状态；使用范围：注册表值；解耦评估：纯数据类型不加载 UI 实现。 */
import type {MobileKeyboardLifecycleState} from "./MobileKeyboardLifecycle.types";

/** 获取或初始化唯一移动键盘生命周期状态。 @同步豁免: 生命周期 */
export const getMobileKeyboardLifecycleState = () => {
    const current = getSForgeState(MOBILE_KEYBOARD_LIFECYCLE_REGISTRY);
    if (current) {
        return current;
    }
    const state: MobileKeyboardLifecycleState = {
        lockUntil: 0,
        renderToolbarTimeout: 0,
        scrollSelectionIntoViewTimeout: 0,
        showUtil: false,
        preventRender: false,
        gestureStartX: 0,
        gestureStartY: 0,
        gestureMoved: false,
    };
    setSForgeState(MOBILE_KEYBOARD_LIFECYCLE_REGISTRY, state);
    return state;
};

/** 清除计时器并移除移动键盘状态，供 HMR、测试和宿主销毁调用。 @同步豁免: 生命周期 */
export const resetMobileKeyboardLifecycleState = () => {
    const state = getSForgeState(MOBILE_KEYBOARD_LIFECYCLE_REGISTRY);
    if (state) {
        clearTimeout(state.renderToolbarTimeout);
        clearTimeout(state.scrollSelectionIntoViewTimeout);
    }
    setSForgeState(MOBILE_KEYBOARD_LIFECYCLE_REGISTRY, undefined);
};
