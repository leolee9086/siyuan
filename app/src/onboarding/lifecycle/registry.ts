/** 用途：读取统一状态；使用范围：引导生命周期；解耦评估：经本子域网关直达基础设施。 */
import {getSForgeState} from "./imports";
/** 用途：写入统一状态；使用范围：引导生命周期；解耦评估：经本子域网关直达基础设施。 */
import {setSForgeState} from "./imports";
/** 用途：定位引导状态；使用范围：注册表唯一槽；解耦评估：独立 Symbol 保持精确类型映射。 */
import {ONBOARDING_LIFECYCLE_STATE} from "./imports";

/** 用途：约束注册状态的完整数据表面；使用范围：初始化状态槽；解耦评估：同目录纯类型不加载行为实现。 */
import type {OnboardingLifecycleState} from "./state.types";

/** 获取或初始化唯一引导生命周期状态。 @同步豁免: 生命周期 */
export const getOnboardingLifecycleState = () => {
    const current = getSForgeState(ONBOARDING_LIFECYCLE_STATE);
    if (current) {
        return current;
    }
    const state: OnboardingLifecycleState = {};
    setSForgeState(ONBOARDING_LIFECYCLE_STATE, state);
    return state;
};

/** 移除事件监听并释放唯一引导生命周期状态，供关闭、测试和宿主销毁调用。 @同步豁免: 生命周期 */
export const resetOnboardingLifecycleState = () => {
    const state = getSForgeState(ONBOARDING_LIFECYCLE_STATE);
    // 登录监听存在时必须先从 Window 移除，避免状态槽释放后留下不可达回调。
    if (state?.pendingLoginHandler) {
        window.removeEventListener("siyuan-login-success", state.pendingLoginHandler);
    }
    // 同步监听与登录监听独立注册，需要分别清理。
    if (state?.pendingSyncHandler) {
        window.removeEventListener("siyuan-sync-success", state.pendingSyncHandler);
    }
    // 移动键盘监听属于同一引导实例，关闭时必须与登录和同步监听一并释放。
    if (state?.mobileKeyboardHandler) {
        window.removeEventListener("siyuan-mobile-keyboard-change", state.mobileKeyboardHandler);
    }
    setSForgeState(ONBOARDING_LIFECYCLE_STATE, undefined);
};
