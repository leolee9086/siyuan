/** 用途：提供独立 Protyle 和基础控件样式；使用范围：ESM 入口配套 CSS；解耦评估：后续提取最小样式后仍需作为模块资源保留。 */
import "./style.scss";
/** 用途：导入公开挂载工厂；使用范围：ESM 入口导出；解耦评估：这是入口的唯一运行能力，应保留直接依赖。 */
import {mountStandaloneProtyle} from "./mount.factory";
/** 用途：导入公开参数类型；使用范围：ESM 类型导出；解耦评估：与挂载工厂共同构成稳定入口。 */
import type {IStandaloneProtyleOptions} from "./standalone.types";
/** 用途：导入菜单宿主协议；使用范围：ESM 类型导出；解耦评估：允许外部宿主提供实现而不依赖具体菜单类。 */
import type {IProtyleMenuPort} from "./imports";

/** 挂载使用独立运行时初始化的 Protyle 实例。 */
export {mountStandaloneProtyle};
/** 独立 Protyle 入口的最小参数。 */
export type {IStandaloneProtyleOptions};
/** 外部宿主可实现的 Protyle 菜单能力协议。 */
export type {IProtyleMenuPort};
