/** 用途：读取并验证注册在全局 Symbol 槽中的视图折叠视觉能力。使用范围：环境注册表读写边界。解耦评估：运行时状态不回流到折叠状态模块。 */
import type {TViewFoldVisualEffects} from "./types";

/**
 * 作用：验证全局注册值是否符合视图折叠视觉能力契约。
 * 意图：HMR 或独立入口未注册时安全回退。
 * 调用时机：每次从 Symbol 注册表读取时。
 * @同步豁免: 类型守卫 - 当前标题加载完成后必须立刻判定注册值是否可安全调用。
 */
export const isViewFoldVisualEffects = (value: unknown): value is TViewFoldVisualEffects => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const effects = value as Partial<TViewFoldVisualEffects>;
    return typeof effects.renderHeadingChildren === "function" && typeof effects.applyDisabledState === "function";
};
