/** 新用户引导在登录与同步事件之间共享的完整生命周期状态。 */
export interface OnboardingLifecycleState {
    pendingLoginHandler?: () => void;
    pendingSyncHandler?: () => void;
    mobileKeyboardHandler?: EventListener;
}
