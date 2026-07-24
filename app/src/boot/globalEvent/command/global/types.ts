/** 表示一次全局命令执行所需的最小上下文，供移动端、桌面端和通用命令执行器共享。 */
export interface GlobalCommandContext<TApplication> {
    app: TApplication;
    command: string;
}

/** 表示全局命令叶子执行器，返回值沿用原 globalCommand 的已处理语义。 */
export type GlobalCommandExecutor<TApplication> = (context: GlobalCommandContext<TApplication>) => boolean;

/** 表示全局命令入口路由选出的处理域，用于从平台分支和通用分支中选择执行器。 */
export type GlobalCommandDomain = "mobile" | "desktop" | "common" | "unhandled";

/** 表示最近关闭标签恢复流程所需的数据，扩展全局命令上下文并携带原始关闭标签与子布局数据。 */
export interface RecentClosedRestoreContext<TApplication> extends GlobalCommandContext<TApplication> {
    childData: ILayoutJSON;
    closeData: ILayoutTab;
}

/** 表示最近关闭标签具体实例类型的恢复处理器。 */
export type RecentClosedRestoreExecutor<TApplication> = (context: RecentClosedRestoreContext<TApplication>) => boolean;
