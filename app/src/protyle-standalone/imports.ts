/** 用途：引入菜单宿主运行时校验；使用范围：独立入口全局兼容桥；解耦评估：校验属于 Protyle 公开契约，应由同层网关转发。 */
import {parseProtyleMenuPort} from "../protyle/runtime/menu.guard";
/** 用途：创建独立入口菜单实现。使用范围：Protyle 独立宿主菜单。解耦评估：由入口网关集中依赖，调用方通过菜单 Port 使用。 */
import {createProtyleMenu} from "../menus/Menu";
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
/** 用途：转发独立脚本加载能力。使用范围：Protyle bootstrap。解耦评估：稳定无状态工具，由入口网关集中依赖。 */
import {loadStandaloneScript} from "../standalone-runtime/assets";
/** 用途：转发独立样式加载能力。使用范围：Protyle bootstrap。解耦评估：稳定无状态工具，由入口网关集中依赖。 */
import {loadStandaloneStyle} from "../standalone-runtime/assets";
/** 用途：转发独立语言加载能力。使用范围：Protyle bootstrap。解耦评估：同源环境协议，由入口网关集中依赖。 */
import {fetchStandaloneLanguage} from "../standalone-runtime/kernel";
/** 用途：转发 Kernel 请求能力。使用范围：Protyle bootstrap。解耦评估：同源环境协议，由入口网关集中依赖。 */
import {postStandaloneKernel} from "../standalone-runtime/kernel";
/** 用途：转发主题属性映射能力。使用范围：Protyle bootstrap。解耦评估：纯环境工具，由入口网关集中依赖。 */
import {applyStandaloneThemeAttributes} from "../standalone-runtime/theme";
/** 用途：转发主题选择能力。使用范围：Protyle bootstrap。解耦评估：纯环境工具，由入口网关集中依赖。 */
import {resolveStandaloneTheme} from "../standalone-runtime/theme";
/** 用途：转发独立入口启动缓存能力。使用范围：Protyle bootstrap 并发初始化。解耦评估：通用 Promise 生命周期工具，由入口网关集中依赖。 */
import {bootstrapStandaloneOnce} from "../standalone-runtime/bootstrap";
/** 导出菜单宿主校验供独立入口守卫使用。 */
export {parseProtyleMenuPort};
/** 导出统一菜单实现；独立入口不再维护第二套菜单 DOM。 */
export {createProtyleMenu};
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
/** 导出共享脚本加载能力。 */
export {loadStandaloneScript};
/** 导出共享样式加载能力。 */
export {loadStandaloneStyle};
/** 导出共享语言加载能力。 */
export {fetchStandaloneLanguage};
/** 导出共享 Kernel 请求能力。 */
export {postStandaloneKernel};
/** 导出共享主题属性映射能力。 */
export {applyStandaloneThemeAttributes};
/** 导出共享主题选择能力。 */
export {resolveStandaloneTheme};
/** 导出共享启动缓存能力。 */
export {bootstrapStandaloneOnce};
