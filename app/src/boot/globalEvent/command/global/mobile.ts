/** 用途：引入移动端 Dock 打开能力。使用范围：仅供本文件移动端 Dock 命令执行器调用。解耦评估：通过同目录网关转发，避免跨层路径散落。 */
import { openDock } from "./imports";
/** 用途：引入移动端主菜单弹出能力。使用范围：仅供 mainMenu 命令执行器调用。解耦评估：移动端菜单是稳定 UI 边界。 */
import { popMenu } from "./imports";
/** 用途：引入移动端搜索菜单弹出能力。使用范围：仅供 globalSearch 命令执行器调用。解耦评估：沿用既有 app 上下文传递边界。 */
import { popSearch } from "./imports";
/** 用途：引入移动端最近文档入口。使用范围：仅供 recentDocs 命令执行器调用。解耦评估：命令层不展开最近文档内部逻辑。 */
import { getRecentDocs } from "./imports";
/** 用途：引入 CaliburRouter 构建 command 路由。使用范围：仅用于本文件路由定义。解耦评估：用户指定参考该 DSL，集中在路由层使用。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：仅与 calibur.split 配套使用。解耦评估：属于 CaliburRouter schema 输入。 */
import { type } from "./imports";
/** 用途：引入移动端命令常量。使用范围：仅用于本文件 split 条件。解耦评估：集中命令契约，避免散落字符串。 */
import { MOBILE_GLOBAL_COMMANDS } from "./commands";
/** 用途：引入全局命令上下文类型。使用范围：仅作为执行器签名类型使用。解耦评估：类型契约来自同目录命令边界。 */
import type { GlobalCommandContext } from "./types";
/** 用途：主应用宿主身份；使用范围：移动命令上下文泛型绑定；解耦评估：具体类型只在实现模块使用。 */
import type {App} from "./imports";

/** 执行移动端文件树命令，命中 fileTree 时打开 file Dock。 */
const executeFileTreeMobileGlobalCommand = () => {
    openDock("file");
    return true;
};

/** 执行移动端普通 Dock 命令，命中 outline/bookmark/tag/inbox 时打开同名 Dock。 */
const executeDirectDockMobileGlobalCommand = ({ command }: GlobalCommandContext<App>) => {
    openDock(command);
    return true;
};

/** 执行移动端反链命令，命中 backlinks 时打开 backlink Dock。 */
const executeBacklinksMobileGlobalCommand = () => {
    openDock("backlink");
    return true;
};

/** 执行移动端主菜单命令，命中 mainMenu 时弹出移动端菜单。 */
const executeMainMenuMobileGlobalCommand = () => {
    popMenu();
    return true;
};

/** 执行移动端全局搜索命令，命中 globalSearch 时弹出移动端搜索。 */
const executeGlobalSearchMobileGlobalCommand = ({ app }: GlobalCommandContext<App>) => {
    popSearch(app);
    return true;
};

/** 执行移动端最近文档命令，命中 recentDocs 时打开最近文档菜单。 */
const executeRecentDocsMobileGlobalCommand = ({ app }: GlobalCommandContext<App>) => {
    getRecentDocs(app);
    return true;
};

/** 移动端命令叶子路由，将命令字符串映射为对应的同步执行器。 */
const mobileGlobalCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${MOBILE_GLOBAL_COMMANDS.FILE_TREE}'` }),  executeFileTreeMobileGlobalCommand)
    .split(type({ command: `'${MOBILE_GLOBAL_COMMANDS.OUTLINE}' | '${MOBILE_GLOBAL_COMMANDS.BOOKMARK}' | '${MOBILE_GLOBAL_COMMANDS.TAG}' | '${MOBILE_GLOBAL_COMMANDS.INBOX}'` }), () => executeDirectDockMobileGlobalCommand)
    .split(type({ command: `'${MOBILE_GLOBAL_COMMANDS.BACKLINKS}'` }), executeBacklinksMobileGlobalCommand)
    .split(type({ command: `'${MOBILE_GLOBAL_COMMANDS.MAIN_MENU}'` }), executeMainMenuMobileGlobalCommand)
    .split(type({ command: `'${MOBILE_GLOBAL_COMMANDS.GLOBAL_SEARCH}'` }), executeGlobalSearchMobileGlobalCommand)
    .remain(() => executeRecentDocsMobileGlobalCommand)
    .build();

/**
 * 执行移动端全局命令。
 * @同步豁免: UI构建 - globalCommand 是同步命令入口，移动端命令立即触发 Dock/菜单 DOM 事件并返回是否已处理。
 */
export const executeMobileGlobalCommand = (context: GlobalCommandContext<App>) => {
    const executor = mobileGlobalCommandRouter({ command: context.command });
    return executor(context);
};
