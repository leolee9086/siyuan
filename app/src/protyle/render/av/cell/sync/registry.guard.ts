/** 用途：描述跨实例同步端口注册表值。使用范围：资产与选择器编辑路径读取已装配的 DOM 同步能力。解耦评估：守卫隔离 Symbol 全局槽的未知值。 */
import type {TAttrViewCellOtherElementsSync} from "./types";

/**
 * 作用：验证跨实例同步端口是否可调用。
 * 意图：独立入口或 HMR 尚未装配时安全退回 no-op。
 * 调用时机：每次低层编辑流程准备同步其它可见实例时。
 * @同步豁免: 类型守卫 - 当前事务更新后必须立刻判断端口能否执行。
 */
export const isAttrViewCellOtherElementsSync = (value: unknown): value is TAttrViewCellOtherElementsSync =>
    typeof value === "function";
