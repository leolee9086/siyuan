/** 用途：验证属性视图单元格更新端口。使用范围：读取 Symbol 注册表前收窄未知值。解耦评估：守卫只依赖纯类型，不加载 cell 实现。 */
import type {TAttrViewCellUpdate} from "./types";

/**
 * 作用：验证全局槽中的单元格更新能力。
 * 意图：独立入口或 HMR 尚未装配时使用明确的异步回退。
 * 调用时机：粘贴或上传流程准备提交属性视图值时。
 * @同步豁免: 类型守卫 - 当前事件必须立即判定端口是否可调用。
 */
export const isAttrViewCellUpdate = (value: unknown): value is TAttrViewCellUpdate =>
    typeof value === "function";
