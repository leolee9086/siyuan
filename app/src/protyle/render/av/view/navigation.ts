/** 用途：约束返回 Panel 的导航命令；使用范围：视图编辑入口；解耦评估：同域 type-only 依赖不加载 Panel 实现。 */
import type {ViewClickOutcome} from "./navigation.types";

/** 构造已完成 HTMLElement 收窄的视图菜单导航命令。 */
/** @同步豁免: UI构建 — 当前点击分发必须同步保留目标元素身份，随后由 Panel 执行菜单打开。 */
/** @显式返回类型原因: 固定 ViewClickOutcome 可防止 kind 从判别字面量拓宽为 string。 */
export const createOpenViewMenuOutcome = (
    blockElement: HTMLElement,
    element: HTMLElement,
): ViewClickOutcome => ({kind: "open-view-menu", blockElement, element});
