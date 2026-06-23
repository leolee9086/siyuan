/**
 * 用途：引入应用实例类型，用于全局命令处理上下文中传递当前 app。
 * 使用范围：仅供 command/global 目录内拆分后的命令执行器签名复用，不在运行时产生依赖。
 * 解耦评估：globalCommand 的既有公共签名已经接收 app，类型层继续沿用该边界即可。
 */
import type { App } from "./imports";

/** 表示一次全局命令执行所需的最小上下文，供移动端、桌面端和通用命令执行器共享。 */
export interface GlobalCommandContext {
    app: App;
    command: string;
}

/** 表示全局命令叶子执行器，返回值沿用原 globalCommand 的已处理语义。 */
export type GlobalCommandExecutor = (context: GlobalCommandContext) => boolean;

/** 表示全局命令入口路由选出的处理域，用于从平台分支和通用分支中选择执行器。 */
export type GlobalCommandDomain = "mobile" | "desktop" | "common" | "unhandled";

/** 表示最近关闭标签恢复流程所需的数据，扩展全局命令上下文并携带原始关闭标签与子布局数据。 */
export interface RecentClosedRestoreContext extends GlobalCommandContext {
    childData: ILayoutJSON;
    closeData: ILayoutTab;
}

/** 表示最近关闭标签具体实例类型的恢复处理器。 */
export type RecentClosedRestoreExecutor = (context: RecentClosedRestoreContext) => boolean;
