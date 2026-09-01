/** 用途：验证属性视图更新端口注册值。使用范围：更新能力环境读写。解耦评估：环境模块只持有 Symbol 槽，不加载 cell 实现。 */
import {isAttrViewCellUpdate} from "./registry.guard";
/** 用途：描述属性视图更新端口。使用范围：注册参数。解耦评估：纯类型依赖不引入高层模块。 */
import type {TAttrViewCellUpdate} from "./types";

const attrViewCellUpdateKey = Symbol.for("sforge.protyle.av.attrViewCellUpdate");

/**
 * 作用：读取当前已注册的单元格更新能力。
 * 意图：低层粘贴和上传模块通过稳定 Symbol 端口调用 cell 所有者。
 * 调用时机：提交属性视图事务前。
 * @同步豁免: 生命周期 - 当前事务必须在同一调用栈取得能力引用。
 */
export const getRegisteredAttrViewCellUpdate = () => {
    const update = Reflect.get(globalThis, attrViewCellUpdateKey);
    if (!isAttrViewCellUpdate(update)) {
        return;
    }
    return update;
};

/**
 * 作用：注册属性视图单元格更新能力。
 * 意图：具体 DOM 与事务实现仍由 cell 组合层拥有。
 * 调用时机：cell 模块完成初始化时。
 * @同步豁免: 生命周期 - 首个粘贴或上传事件前必须同步完成注册。
 */
export const registerAttrViewCellUpdate = (update: TAttrViewCellUpdate) => {
    const didRegister = Reflect.set(globalThis, attrViewCellUpdateKey, update);
    if (!didRegister) {
        throw new Error("Unable to register attribute view cell update");
    }
};
