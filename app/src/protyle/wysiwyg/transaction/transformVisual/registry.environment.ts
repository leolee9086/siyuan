/** 用途：验证全局槽中的视觉能力。使用范围：转换视觉端口的生命周期读操作。解耦评估：守卫隔离全局存储的未知值。 */
import {isTransactionTransformVisualEffects} from "./registry.guard";
/** 用途：描述要写入的视觉能力。使用范围：转换视觉端口的生命周期注册。解耦评估：纯类型不加载渲染实现。 */
import type {TTransactionTransformVisualEffects} from "./types";

const transactionTransformVisualEffectsKey = Symbol.for("sforge.protyle.transactionTransformVisualEffects");

/**
 * 作用：读取当前注册的转换视觉能力。
 * 意图：将跨调用状态放入具名 Symbol 槽，避免模块级可变对象和 HMR 状态分裂。
 * 调用时机：转换命令准备回放操作或刷新内容时。
 * @同步豁免: 生命周期 - 输入事务在当前事件栈内需要立刻读取已注册的视觉能力。
 */
export const getRegisteredTransactionTransformVisualEffects = () => {
    const effects = Reflect.get(globalThis, transactionTransformVisualEffectsKey);
    if (!isTransactionTransformVisualEffects(effects)) {
        return;
    }
    return effects;
};

/**
 * 作用：注册转换视觉能力。
 * 意图：由组合层拥有高层渲染依赖，低层命令只读取 Symbol 注册表。
 * 调用时机：Protyle 视觉效果模块初始化。
 * @同步豁免: 生命周期 - 首个转换命令前必须同步完成端口注册。
 */
export const registerTransactionTransformVisualEffects = (effects: TTransactionTransformVisualEffects) => {
    const didRegister = Reflect.set(globalThis, transactionTransformVisualEffectsKey, effects);
    if (!didRegister) {
        throw new Error("Unable to register transaction transform visual effects");
    }
};
