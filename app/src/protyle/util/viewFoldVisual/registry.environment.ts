/** 用途：验证全局槽中的视图折叠视觉能力。使用范围：折叠视觉端口的生命周期读操作。解耦评估：守卫隔离全局存储的未知值。 */
import {isViewFoldVisualEffects} from "./registry.guard";
/** 用途：描述要写入的视图折叠视觉能力。使用范围：折叠视觉端口的生命周期注册。解耦评估：纯类型不加载渲染实现。 */
import type {TViewFoldVisualEffects} from "./types";

const viewFoldVisualEffectsKey = Symbol.for("sforge.protyle.viewFoldVisualEffects");

/**
 * 作用：读取当前注册的视图折叠视觉能力。
 * 意图：将跨调用状态放入具名 Symbol 槽，避免模块级可变对象和 HMR 状态分裂。
 * 调用时机：异步标题子块加载完成后。
 * @同步豁免: 生命周期 - 标题 DOM 插入后必须同步读取已注册的视觉能力。
 */
export const getRegisteredViewFoldVisualEffects = () => {
    const effects = Reflect.get(globalThis, viewFoldVisualEffectsKey);
    if (!isViewFoldVisualEffects(effects)) {
        return;
    }
    return effects;
};

/**
 * 作用：注册视图折叠视觉能力。
 * 意图：由组合层拥有高层渲染和禁用态依赖，低层折叠状态只读取 Symbol 注册表。
 * 调用时机：Protyle 视觉效果模块初始化。
 * @同步豁免: 生命周期 - 首个标题异步加载完成前必须同步完成端口注册。
 */
export const registerViewFoldVisualEffects = (effects: TViewFoldVisualEffects) => {
    const didRegister = Reflect.set(globalThis, viewFoldVisualEffectsKey, effects);
    if (!didRegister) {
        throw new Error("Unable to register view fold visual effects");
    }
};
