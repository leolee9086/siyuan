/** 用途：读取属性视图单元格更新端口。使用范围：粘贴、上传和低层编辑提交。解耦评估：端口只读取环境注册表，不加载 cell 实现。 */
import {getRegisteredAttrViewCellUpdate} from "./registry.environment";
/** 用途：写入属性视图单元格更新端口。使用范围：cell 组合层初始化。解耦评估：端口只转发注册动作，不加载更新实现。 */
import {registerAttrViewCellUpdate} from "./registry.environment";
/** 用途：描述单元格更新端口。使用范围：注册和 no-op 回退。解耦评估：纯类型不加载 cell 实现。 */
import type {IAttrViewCellUpdateOptions, IAttrViewCellUpdateResult, TAttrViewCellUpdate} from "./types";

/**
 * 作用：为未装配宿主返回空更新结果。
 * 意图：独立粘贴入口能够完成 Promise，而不静默伪造事务。
 * 调用时机：cell 组合层尚未注册更新能力时。
 * @同步豁免: 生命周期 - 当前事件必须同步取得确定的回退函数。
 */
const unavailableAttrViewCellUpdate: TAttrViewCellUpdate = async (
    _options: IAttrViewCellUpdateOptions,
): Promise<IAttrViewCellUpdateResult> => ({
    text: "",
    json: [],
    doOperations: [],
    undoOperations: [],
});

/**
 * 作用：读取属性视图单元格更新能力或空结果回退。
 * 意图：低层模块不反向导入 cell 聚合实现。
 * 调用时机：粘贴或上传流程提交值前。
 * @同步豁免: 生命周期 - 当前调用栈需要立即获得稳定能力引用。
 */
export const getAttrViewCellUpdate = () =>
    getRegisteredAttrViewCellUpdate() || unavailableAttrViewCellUpdate;

/**
 * 作用：发布属性视图单元格更新实现。
 * 意图：保持 cell 组合层为唯一事务和 DOM 更新所有者。
 * 调用时机：cell 模块装配完成后。
 * @同步豁免: 生命周期 - 首个更新事件前必须同步完成端口注册。
 */
export const setAttrViewCellUpdate = (update: TAttrViewCellUpdate) => {
    registerAttrViewCellUpdate(update);
};
