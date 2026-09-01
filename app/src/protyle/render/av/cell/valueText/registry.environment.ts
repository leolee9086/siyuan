/** 用途：验证属性视图文本测量注册值。使用范围：文本端口环境读写。解耦评估：环境模块只持有 Symbol 槽，不加载 cell 实现。 */
import {isAttrViewCellValueText} from "./registry.guard";
/** 用途：描述属性视图文本测量能力。使用范围：注册参数。解耦评估：纯类型依赖不引入渲染实现。 */
import type {TAttrViewCellValueText} from "./types";

const attrViewCellValueTextKey = Symbol.for("sforge.protyle.av.attrViewCellValueText");

/**
 * 作用：读取当前注册的文本测量能力。
 * 意图：关联视图与 cell 渲染实现保持单向依赖。
 * 调用时机：关联视图计算列宽时。
 * @同步豁免: 生命周期 - 同一布局计算中必须立即取得稳定函数引用。
 */
export const getRegisteredAttrViewCellValueText = () => {
    const measureText = Reflect.get(globalThis, attrViewCellValueTextKey);
    if (!isAttrViewCellValueText(measureText)) {
        return;
    }
    return measureText;
};

/**
 * 作用：注册属性视图文本测量能力。
 * 意图：cell 组合层继续拥有完整渲染文本语义。
 * 调用时机：cell 模块装配完成时。
 * @同步豁免: 生命周期 - 首个关联视图布局计算前必须同步完成注册。
 */
export const registerAttrViewCellValueText = (measureText: TAttrViewCellValueText) => {
    const didRegister = Reflect.set(globalThis, attrViewCellValueTextKey, measureText);
    if (!didRegister) {
        throw new Error("Unable to register attribute view cell text measurement");
    }
};
