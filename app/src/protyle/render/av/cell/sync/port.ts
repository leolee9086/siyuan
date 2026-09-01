/** 用途：读取属性视图跨实例同步能力。使用范围：资产和选择编辑流程更新其它可见单元格。解耦评估：环境注册表持有跨调用状态，端口自身无状态。 */
import {getRegisteredAttrViewCellOtherElementsSync} from "./registry.environment";
/** 用途：写入属性视图跨实例同步能力。使用范围：cell 组合层初始化具体 DOM 实现。解耦评估：环境注册表持有跨调用状态，端口自身无状态。 */
import {registerAttrViewCellOtherElementsSync} from "./registry.environment";
/** 用途：描述跨实例同步端口。使用范围：注册参数和未装配回退。解耦评估：纯类型不加载 cell 实现。 */
import type {TAttrViewCellOtherElementsSync} from "./types";

/**
 * 作用：忽略未注册宿主的跨实例同步请求。
 * 意图：独立入口可加载资产编辑逻辑而不强制加载完整 cell 组合层。
 * 调用时机：端口尚未由 cell 装配时。
 * @同步豁免: 生命周期 - 事务提交前必须同步完成 no-op 回退，避免空端口中断编辑流程。
 */
const ignoreAttrViewCellOtherElementsSync: TAttrViewCellOtherElementsSync = (
    protyle,
    avID,
    rowID,
    colID,
    value,
    sourceElement,
) => {
    void protyle;
    void avID;
    void rowID;
    void colID;
    void value;
    void sourceElement;
};

/**
 * 作用：读取属性视图跨实例同步能力或无操作回退。
 * 意图：保持低层编辑路径可在完整或独立宿主中同步运行。
 * 调用时机：源单元格已完成动画刷新后。
 * @同步豁免: 生命周期 - 默认事务继续前必须在当前调用栈取得稳定端口。
 */
export const getAttrViewCellOtherElementsSync = () =>
    getRegisteredAttrViewCellOtherElementsSync() || ignoreAttrViewCellOtherElementsSync;

/**
 * 作用：注册属性视图跨实例同步实现。
 * 意图：只让 cell 组合层持有高层 DOM 更新代码，避免编辑子域反向依赖。
 * 调用时机：cell 模块评价完成后立即注册。
 * @同步豁免: 生命周期 - 首次编辑事件前必须同步完成注册。
 */
export const setAttrViewCellOtherElementsSync = (sync: TAttrViewCellOtherElementsSync) => {
    registerAttrViewCellOtherElementsSync(sync);
};
