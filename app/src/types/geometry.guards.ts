/**
 * 几何类型厂牌构造器
 * 使用 as 断言附加厂牌，TS 无法自动推导交叉类型中的符号属性
 */
/** 用途：Point 几何点类型。使用范围：createPoint 返回类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Point } from "./geometry.types";
/** 用途：BoundingRect 矩形边界类型。使用范围：createBoundingRect 返回类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { BoundingRect } from "./geometry.types";
/** 用途：Rect 矩形区域类型。使用范围：createRect 返回类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Rect } from "./geometry.types";

/** @同步豁免: 类型守卫 */
export function createPoint(x: number, y: number) {
    return [x, y] as Point;
}

/**
 * 创建 BoundingRect 厂牌类型
 * @参数豁免: 第三方接口适配
 */
/** @同步豁免: 类型守卫 */
export function createBoundingRect(left: number, top: number, right: number, bottom: number) {
    // @内联数组 构造 BoundingRect 厂牌元组
    return [left, top, right, bottom] as BoundingRect;
}

/**
 * 创建 Rect 厂牌类型
 * @参数豁免: 第三方接口适配
 */
/** @同步豁免: 类型守卫 */
export function createRect(left: number, top: number, width: number, height: number) {
    // @内联数组 构造 Rect 厂牌元组
    return [left, top, width, height] as Rect;
}
