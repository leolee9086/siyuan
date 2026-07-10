/** 用途：Point 几何点类型。使用范围：computeSelectRect 模块坐标钳制计算。解耦评估：类型导入，不涉及运行时耦合。 */
import type { Point } from "../../types/geometry.types";
/** 用途：BoundingRect 矩形边界类型。使用范围：computeSelectRect 模块坐标钳制计算。解耦评估：类型导入，不涉及运行时耦合。 */
import type { BoundingRect } from "../../types/geometry.types";
/** 用途：createPoint 构造器。使用范围：构造 Point 类型坐标。解耦评估：通过 imports.ts 转发。 */
import { createPoint } from "./imports";
/** 用途：createRect 构造器。使用范围：返回厂牌 Rect 类型。解耦评估：通过 imports.ts 转发。 */
import { createRect } from "./imports";

/**
 * 计算从锚点向鼠标方向拖拽延伸的矩形，并钳制延伸边到边界内
 * 锚点所在的边固定不动，只钳制拖拽延伸的那一边
 * @param anchor - [x, y] 锚点（拖拽起始点）
 * @param current - [x, y] 当前鼠标位置
 * @param bounds - [left, top, right, bottom] 边界约束
 */
function computeDragClipRect(anchor: Point, current: Point, bounds: BoundingRect) {
    let left = 0;
    let top = 0;
    let width = 0;
    let height = 0;

    // 向左拖拽时钳制左边缘，向右拖拽时钳制右边缘
    if (current[0] < anchor[0]) {
        left = Math.max(current[0], bounds[0]);
        width = anchor[0] - left;
    }
    // 向右（含相等）拖拽时，右边缘取鼠标位置但不多于 mostRight
    if (current[0] >= anchor[0]) {
        left = anchor[0];
        width = Math.min(current[0], bounds[2]) - anchor[0];
    }

    // 向下拖拽时钳制底边缘，向上拖拽时钳制顶边缘
    if (current[1] > anchor[1]) {
        top = anchor[1];
        height = Math.min(current[1], bounds[3]) - anchor[1];
    }
    // 向上（含相等）拖拽时，顶边缘取鼠标位置但不少于 mostTop
    if (current[1] <= anchor[1]) {
        top = Math.max(current[1], bounds[1]);
        height = anchor[1] - top;
    }

    return createRect(left, top, Math.max(0, width), Math.max(0, height));
}

/**
 * 计算拖拽选择区域的位置和尺寸
 * 从 MouseEvent 提取坐标后委托纯坐标计算函数
 */
/** @同步豁免: UI构建 */
export function computeSelectRect(options: {
    /** 当前鼠标事件 */
    moveEvent: MouseEvent;
    /** 锚点坐标 [x, y]（拖拽起始点） */
    anchor: Point;
    /** 边界约束 [left, top, right, bottom] */
    bounds: BoundingRect;
}) {
    const { moveEvent, anchor, bounds } = options;
    return computeDragClipRect(anchor, createPoint(moveEvent.clientX, moveEvent.clientY), bounds);
}
