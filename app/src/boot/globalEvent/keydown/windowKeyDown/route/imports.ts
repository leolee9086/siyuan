/**
 * 用途：集中转发窗口级键盘事件"路由阶段"所需的命令契约、统一状态类型与路由 DSL。
 * 使用范围：仅供 `windowKeyDown/route` 目录中的子路由与根路由复用。
 * 解耦评估：路由阶段只依赖共享命令常量、统一状态契约和 DSL，本文件把这些依赖收敛到单点，避免子路由文件重新散落父级路径。
 */

/** 用途：引入路由 DSL calibur-router，用于声明式地以状态空间分割构建路由链。使用范围：route/ 目录下所有子路由通过 barrel 共享使用。解耦评估：calibur-router 是路由层的核心 DSL，消费端固定；切换 DSL 实现时仅需修改本文件的导入源。 */
import { calibur } from "calibur-router";
/** 用途：引入 arktype 类型工厂函数 `type`，用于在路由阶段定义状态输入 schema 与 split 模式匹配条件。使用范围：route/ 目录下各子路由文件通过 barrel 重导出使用，不扩散至 route 外部。解耦评估：`type()` 仅在路由定义期使用，运行期零额外开销；已通过本 barrel 集中转发，替换类型方案时仅需修改本文件。 */
import { type } from "arktype";

/**
 * 用途：引入对话框、导航、系统、UI 四个子域的命令常量与衍生类型，用于在路由阶段直接映射 facts → command。
 * 使用范围：route/ 目录下所有子路由共享使用。
 * 解耦评估：命令常量与状态类型已分离为独立文件；命令常量是路由层与执行器层的共享契约，
 * 通过 type-only 和 value import 保持类型安全，未重复硬编码字符串值。
 * 当前路由阶段通过 calibur-router 的类型安全 split 模式与 arktype schema 完成路由，
 * 不直接读写业务状态，可独立替换路由实现。
 */
import { DIALOG_WINDOW_KEY_COMMANDS, NAVIGATION_WINDOW_KEY_COMMANDS, SYSTEM_WINDOW_KEY_COMMANDS, UI_WINDOW_KEY_COMMANDS } from "../commands.types";
/** 用途：引入对话框、导航、系统、UI 四个子域的命令衍生类型，用于路由阶段 split 模式匹配与 command 映射的类型约束。使用范围：route/ 目录下所有子路由共享使用。解耦评估：纯类型依赖，仅用于类型标注，不形成运行时耦合；已通过 barrel 集中转发。 */
import type { DialogWindowKeyCommand, NavigationWindowKeyCommand, SystemWindowKeyCommand, UIWindowKeyCommand, WindowKeyDownResolvedCommands, WindowKeyDownRouteDomain } from "../commands.types";

/**
 * 用途：引入统一状态类型 [`WindowKeyDownState`]，用于在路由阶段声明路由输入 schema 的类型边界。
 * 使用范围：route/ 目录下所有子路由共享使用。
 * 解耦评估：纯类型依赖，仅用于 arktype `type(...)` schema 的类型推导，不形成运行时耦合。
 */
import type { WindowKeyDownRouteState } from "../types";

// 导出：路由 DSL calibur-router
export { calibur };
// 导出：arktype 类型工厂
export { type };
// 导出：对话框域命令常量
export { DIALOG_WINDOW_KEY_COMMANDS };
// 导出：导航域命令常量
export { NAVIGATION_WINDOW_KEY_COMMANDS };
// 导出：系统域命令常量
export { SYSTEM_WINDOW_KEY_COMMANDS };
// 导出：UI 抢占域命令常量
export { UI_WINDOW_KEY_COMMANDS };
// 导出：对话框命令类型
export type { DialogWindowKeyCommand };
// 导出：导航命令类型
export type { NavigationWindowKeyCommand };
// 导出：系统命令类型
export type { SystemWindowKeyCommand };
// 导出：UI 命令类型
export type { UIWindowKeyCommand };
// 导出：窗口键解析命令联合类型
export type { WindowKeyDownResolvedCommands };
// 导出：窗口键路由域联合类型
export type { WindowKeyDownRouteDomain };
// 导出：路由阶段只消费事实视图，不持有应用和对话框实现身份
export type WindowKeyDownState = WindowKeyDownRouteState;
