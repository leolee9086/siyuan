/** 用途：提供独立 Protyle 和基础控件样式；使用范围：ESM 入口配套 CSS；解耦评估：后续提取最小样式后仍需作为模块资源保留。 */
import "./style.scss";
/** 用途：导入公开挂载工厂；使用范围：ESM 入口导出；解耦评估：这是入口的唯一运行能力，应保留直接依赖。 */
import {mountStandaloneProtyle} from "./mount.factory";
/** 用途：导入公开参数类型；使用范围：ESM 类型导出；解耦评估：与挂载工厂共同构成稳定入口。 */
import type {IStandaloneProtyleOptions} from "./standalone.types";
/** 用途：导入菜单宿主协议；使用范围：ESM 类型导出；解耦评估：允许外部宿主提供实现而不依赖具体菜单类。 */
import type {IProtyleMenuPort} from "./imports";
import type {IProtyleDialogPort} from "../protyle/runtime/dialog.types";
/** 用途：导出挂载完成后的实例类型；使用范围：外部宿主编程控制菜单；解耦评估：仅类型依赖，不引入运行时模块。 */
import type {IStandaloneProtyleInstance} from "./standalone.types";
/** 用途：导出统一菜单宿主工厂；使用范围：外部应用验证宿主能力契约；解耦评估：独立入口与完整 App 共用 Menu 实现。 */
import {createProtyleMenu} from "./imports";

/** 挂载使用独立运行时初始化的 Protyle 实例。 */
export {mountStandaloneProtyle};
/** 创建统一菜单能力宿主，供外部应用验证接口契约并编程控制菜单显示和隐藏。 */
export {createProtyleMenu};
/** @deprecated 使用 createProtyleMenu；保留别名避免早期独立入口调用方断裂。 */
export const createStandaloneProtyleMenu = createProtyleMenu;
/** 独立 Protyle 入口的最小参数。 */
export type {IStandaloneProtyleOptions};
/** 独立挂载完成后返回的编辑器和菜单控制能力。 */
export type {IStandaloneProtyleInstance};
/** 外部宿主可实现的 Protyle 菜单能力协议。 */
export type {IProtyleMenuPort};
/** 外部宿主可实现的 Protyle Dialog 能力协议。 */
export type {IProtyleDialogPort};
