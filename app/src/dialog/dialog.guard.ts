/**
 * 对话框模块类型守卫
 *
 * @deprecated 请从 '@/util/DOM/element.guard' 导入统一的类型守卫
 */

/** 用途：HTMLElement 类型守卫。使用范围：对话框 DOM 操作。解耦评估：通过本目录 imports.ts 转发。 */
import { isHTMLElement } from "./imports";
/**
 * 判断是否为 HTMLElement
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export { isHTMLElement };

/** 用途：SVGElement 类型守卫。使用范围：对话框 SVG 操作。解耦评估：通过本目录 imports.ts 转发。 */
import { isSVGElement } from "./imports";
/**
 * 判断是否为 SVGElement
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export { isSVGElement };

/** 用途：SVGUseElement 类型守卫。使用范围：对话框 SVG use 操作。解耦评估：通过本目录 imports.ts 转发。 */
import { isSVGUseElement } from "./imports";
/**
 * 判断是否为 SVGUseElement
 * @deprecated 请从 '@/util/DOM/element.guard' 导入
 */
export { isSVGUseElement };
