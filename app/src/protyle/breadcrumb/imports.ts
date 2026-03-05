/**
 * 面包屑模块依赖聚合
 * 说明：该文件是目录内唯一允许的父级依赖导入入口。
 */

/*
 * 用途：元素基础类型守卫。
 * 使用范围：面包屑模块内部所有 DOM 类型收窄分支。
 * 解耦评估：纯函数依赖，可通过参数注入替代；当前作为零状态基础工具直接依赖更高效。
 */
import { isElement } from "../../util/DOM/element.guard";
/*
 * 用途：HTMLElement 类型守卫。
 * 使用范围：面包屑渲染与事件处理中 HTMLElement 判定。
 * 解耦评估：纯函数依赖，可注入；直接导入能减少样板代码并保持性能。
 */
import { isHTMLElement } from "../../util/DOM/element.guard";
/*
 * 用途：HTMLInputElement 类型守卫。
 * 使用范围：面包屑输入节点识别流程。
 * 解耦评估：纯函数依赖，可注入；当前直接依赖边界清晰且无状态耦合。
 */
import { isHTMLInputElement } from "../../util/DOM/element.guard";
/*
 * 用途：SVGElement 类型守卫。
 * 使用范围：面包屑图标节点和 SVG 路径处理。
 * 解耦评估：纯函数依赖，可注入；当前直接导入可维持调用开销最小。
 */
import { isSVGElement } from "../../util/DOM/element.guard";
/*
 * 用途：可样式化元素守卫。
 * 使用范围：面包屑事件冒泡遍历和样式更新流程。
 * 解耦评估：纯函数依赖，可注入；直接导入更利于复用与一致性。
 */
import { isStylableElement } from "../../util/DOM/element.guard";

// 导出基础元素守卫，供本目录模块复用。
export { isElement };
// 导出 HTMLElement 守卫，统一类型收窄逻辑。
export { isHTMLElement };
// 导出 HTMLInputElement 守卫，统一输入元素判定逻辑。
export { isHTMLInputElement };
// 导出 SVGElement 守卫，统一图标节点判定逻辑。
export { isSVGElement };
// 导出可样式化元素守卫，统一交互节点判定逻辑。
export { isStylableElement };
