/** 用途：引入菜单宿主运行时校验；使用范围：独立入口全局兼容桥；解耦评估：校验属于 Protyle 公开契约，应由同层网关转发。 */
import {parseProtyleMenuPort} from "../protyle/runtime/menu.guard";
/** 用途：创建当前 Protyle 实例；使用范围：独立 ESM 挂载工厂；解耦评估：目标模块本体，保持标准模块导入。 */
import {Protyle} from "../protyle";
/** 用途：注册迁移期 Model 处理器；使用范围：独立 WebSocket 初始化；解耦评估：SyncPort 落地后删除。 */
import {setSForgeState} from "../config/sforge.global";
/** 用途：定位迁移期 Model 注册槽；使用范围：独立 WebSocket 初始化；解耦评估：SyncPort 落地后删除。 */
import {SForgeSymbols} from "../config/sforge.symbols";
/** 用途：注册独立 Dialog 宿主；使用范围：挂载工厂创建 Protyle 前安装能力；解耦评估：同层网关转发，允许未来替换为 Local RPC。 */
import {setProtyleDialogPort} from "../protyle/runtime/dialog.port";
/** 用途：公开菜单宿主能力类型；使用范围：ESM 入口和挂载参数；解耦评估：属于稳定宿主协议。 */
import type {IProtyleMenuPort} from "../protyle/runtime/menu.types";
/** 用途：公开独立 Dialog 宿主类型；使用范围：挂载参数和 ESM 入口类型转出；解耦评估：纯类型依赖，可被外部实现替换。 */
import type {IProtyleDialogPort} from "../protyle/runtime/dialog.types";
/** 导出菜单宿主校验供独立入口守卫使用。 */
export {parseProtyleMenuPort};
/** 导出 Protyle 类供独立挂载工厂创建实例。 */
export {Protyle};
/** 导出注册函数供独立挂载工厂安装最小消息处理器。 */
export {setSForgeState};
/** 导出注册键供独立挂载工厂定位处理器槽。 */
export {SForgeSymbols};
/** 导出独立 Dialog 宿主注册函数供挂载工厂使用。 */
export {setProtyleDialogPort};
/** 导出菜单宿主能力类型供独立入口转出。 */
export type {IProtyleMenuPort};
/** 导出弹窗宿主能力类型供独立入口转出。 */
export type {IProtyleDialogPort};
