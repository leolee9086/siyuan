/** 用途：验证属性视图跨实例同步端口。使用范围：读取 Symbol 注册表前收窄未知全局值。解耦评估：守卫位于同一低层端口子域，不加载 cell 实现。 */
import {isAttrViewCellOtherElementsSync} from "./registry.guard";
/** 用途：描述要写入属性视图跨实例同步注册表的能力。使用范围：端口生命周期注册。解耦评估：纯类型依赖，不加载 DOM 同步实现。 */
import type {TAttrViewCellOtherElementsSync} from "./types";

const attrViewCellOtherElementsSyncKey = Symbol.for("sforge.protyle.av.attrViewCellOtherElementsSync");

/**
 * 作用：读取当前已注册的属性视图跨实例同步能力。
 * 意图：低层资产编辑不反向加载 cell 聚合模块，保持依赖图单向。
 * 调用时机：资产或选择编辑流程更新源单元格后。
 * @同步豁免: 生命周期 - 同一事务内必须立即同步其它可见实例，不能等待异步调度。
 */
export const getRegisteredAttrViewCellOtherElementsSync = () => {
    const sync = Reflect.get(globalThis, attrViewCellOtherElementsSyncKey);
    if (!isAttrViewCellOtherElementsSync(sync)) {
        return;
    }
    return sync;
};

/**
 * 作用：注册属性视图跨实例同步能力。
 * 意图：cell 组合层拥有具体 DOM 渲染实现，编辑子域只通过稳定端口请求同步。
 * 调用时机：cell 模块首次装配时。
 * @同步豁免: 生命周期 - 任一资产编辑事件执行前必须同步固定该能力引用。
 */
export const registerAttrViewCellOtherElementsSync = (sync: TAttrViewCellOtherElementsSync) => {
    const didRegister = Reflect.set(globalThis, attrViewCellOtherElementsSyncKey, sync);
    if (!didRegister) {
        throw new Error("Unable to register attribute view cell synchronization");
    }
};
