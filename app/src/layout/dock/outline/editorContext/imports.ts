/** 用途：查找当前文档对应的完整编辑器模型；使用范围：Outline 编辑器上下文解析；解耦评估：直接指向布局模型查询唯一实现，不经菜单或 Outline 根模块转发。 */
import {getAllModels} from "../../../getAll";
/** 用途：验证查询到的块节点具备 HTMLElement 运行时身份；使用范围：Outline 编辑器上下文解析；解耦评估：直接复用 Dock DOM 守卫唯一实现。 */
import {isHTMLElement} from "../../dock.guard";
/** 用途：描述完整 Outline 领域根及解析结果；使用范围：Outline 编辑器上下文解析；解耦评估：纯类型直接指向完整领域定义，不依赖具体 Outline class。 */
import type {OutlineDomain, OutlineEditorContext} from "../types";

/** 导出布局模型查询能力。 */
export {getAllModels};
/** 导出 HTMLElement 运行时守卫。 */
export {isHTMLElement};
/** 导出完整 Outline 领域根。 */
export type {OutlineDomain};
/** 导出 Outline 编辑器上下文结果。 */
export type {OutlineEditorContext};
