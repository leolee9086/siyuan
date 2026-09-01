/** 用途：验证属性视图文本测量端口。使用范围：读取 Symbol 注册表前收窄未知值。解耦评估：守卫只依赖纯类型，不加载 cell 渲染实现。 */
import type {TAttrViewCellValueText} from "./types";

/**
 * 作用：验证全局槽中的文本测量能力。
 * 意图：独立入口或 HMR 未装配时安全返回回退函数。
 * 调用时机：关联视图计算列宽前。
 * @同步豁免: 类型守卫 - 当前布局计算必须立即判定端口可用性。
 */
export const isAttrViewCellValueText = (value: unknown): value is TAttrViewCellValueText =>
    typeof value === "function";
