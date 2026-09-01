/** 用途：读取并验证注册在全局 Symbol 槽中的转换视觉能力。使用范围：环境注册表读写边界。解耦评估：运行时状态不回流到转换命令模块。 */
import type {TTransactionTransformVisualEffects} from "./types";

/**
 * 作用：验证全局注册值是否符合转换视觉能力契约。
 * 意图：HMR 或独立入口未注册时安全回退。
 * 调用时机：每次从 Symbol 注册表读取时。
 * @同步豁免: 类型守卫 - 当前输入事务必须立刻判定注册值是否可安全调用。
 */
export const isTransactionTransformVisualEffects = (value: unknown): value is TTransactionTransformVisualEffects => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const effects = value as Partial<TTransactionTransformVisualEffects>;
    return typeof effects.applyOperations === "function" && typeof effects.rerender === "function" &&
        typeof effects.renderBlock === "function" && typeof effects.renderConvertedBlocks === "function";
};
