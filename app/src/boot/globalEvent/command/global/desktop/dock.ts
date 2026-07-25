/** 用途：引入 Dock 获取工具。使用范围：执行桌面 Dock 切换命令。解耦评估：通过本目录网关集中依赖布局工具。 */
import { getDockByType } from "./imports";
/** 用途：引入路由构建器。使用范围：声明桌面 Dock 命令路由。解耦评估：命令匹配集中在 CaliburRouter。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：声明桌面 Dock 命令 split 条件。解耦评估：路由 schema 与执行逻辑分离。 */
import { type } from "./imports";
/** 用途：引入桌面命令常量。使用范围：避免 Dock 命令字符串散落。解耦评估：命令契约集中定义。 */
import { DESKTOP_GLOBAL_COMMANDS } from "./imports";
/** 用途：引入全局命令上下文类型。使用范围：标注 Dock 执行器参数。解耦评估：复用全局命令边界。 */
import type { GlobalCommandContext } from "./imports";
/** 用途：主应用宿主身份；使用范围：桌面 Dock 命令上下文绑定；解耦评估：具体类型只在实现模块使用。 */
import type { AppFacade } from "./imports";

/** 切换指定 Dock 模型。 */
const toggleDockModel = (type: string) => {
    getDockByType(type)?.toggleModel(type);
    return true;
};

/** 桌面 Dock 类型路由，将命令字符串映射为布局层实际 Dock 类型。 */
const desktopDockTypeRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.FILE_TREE}'` }), () => "file")
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.OUTLINE}'` }), () => "outline")
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.BOOKMARK}' | '${DESKTOP_GLOBAL_COMMANDS.TAG}' | '${DESKTOP_GLOBAL_COMMANDS.INBOX}'` }), ({ command }) => command)
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.BACKLINKS}'` }), () => "backlink")
    .split(type({ command: `'${DESKTOP_GLOBAL_COMMANDS.GRAPH_VIEW}'` }), () => "graph")
    .remain(() => "globalGraph")
    .build();

/**
 * 执行桌面 Dock 命令。
 * @同步豁免: UI构建 - Dock 切换是同步 UI 响应，命令入口需要立即返回处理状态。
 */
export const executeDesktopDockGlobalCommand = (context: GlobalCommandContext<AppFacade>) => {
    const dockType = desktopDockTypeRouter({ command: context.command });
    return toggleDockModel(dockType);
};
