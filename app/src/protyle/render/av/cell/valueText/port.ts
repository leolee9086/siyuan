/** 用途：读取属性视图文本测量端口。使用范围：关联视图列宽计算。解耦评估：端口读取环境注册表，不加载 cell 实现。 */
import {getRegisteredAttrViewCellValueText} from "./registry.environment";
/** 用途：写入属性视图文本测量端口。使用范围：cell 组合层初始化。解耦评估：端口只转发注册动作。 */
import {registerAttrViewCellValueText} from "./registry.environment";
/** 用途：描述文本测量端口。使用范围：注册和 no-op 回退。解耦评估：纯类型不加载渲染实现。 */
import type {TAttrViewCellValueText} from "./types";

/**
 * 作用：为未装配宿主提供文本测量回退。
 * 意图：独立关联视图入口可完成布局计算而不抛出模块缺失异常。
 * 调用时机：cell 组合层尚未注册测量能力时。
 * @同步豁免: 生命周期 - 当前布局计算需要同步取得确定函数。
 */
const unavailableAttrViewCellValueText: TAttrViewCellValueText = (_value, _column, _rowIndex) => "";

/**
 * 作用：读取属性视图文本测量能力或回退。
 * 意图：低层关联视图不反向导入 cell 聚合模块。
 * 调用时机：计算关联表列宽时。
 * @同步豁免: 生命周期 - 当前布局计算中必须立即获得稳定能力引用。
 */
export const getAttrViewCellValueText = () =>
    getRegisteredAttrViewCellValueText() || unavailableAttrViewCellValueText;

/**
 * 作用：发布属性视图文本测量实现。
 * 意图：保留 cell 渲染器对完整 HTML 到文本语义的所有权。
 * 调用时机：cell 模块装配完成后。
 * @同步豁免: 生命周期 - 首个关联视图计算前必须同步完成端口注册。
 */
export const setAttrViewCellValueText = (measureText: TAttrViewCellValueText) => {
    registerAttrViewCellValueText(measureText);
};
