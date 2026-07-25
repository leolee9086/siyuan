/** 用途：引入平台判断。使用范围：根路由选择移动端或桌面端命令域。解耦评估：平台状态通过 global/imports.ts 网关集中访问。 */
import { isMobile } from "./global/imports";
/** 用途：引入 CaliburRouter 构建 command 域路由。使用范围：globalCommand 根分发。解耦评估：根入口只选择执行器，不承载业务细节。 */
import { calibur } from "./global/imports";
/** 用途：引入 arktype 类型声明器。使用范围：根路由 split 条件。解耦评估：属于 CaliburRouter schema 基础设施。 */
import { type } from "./global/imports";
/** 用途：引入移动端命令值列表。使用范围：识别移动端命令域。解耦评估：命令契约集中在 commands.ts。 */
import { MOBILE_GLOBAL_COMMAND_VALUES } from "./global/commands";
/** 用途：引入桌面端命令值列表。使用范围：识别桌面端命令域。解耦评估：命令契约集中在 commands.ts。 */
import { DESKTOP_GLOBAL_COMMAND_VALUES } from "./global/commands";
/** 用途：引入通用命令值列表。使用范围：识别跨平台通用命令域。解耦评估：命令契约集中在 commands.ts。 */
import { COMMON_GLOBAL_COMMAND_VALUES } from "./global/commands";
/** 用途：引入移动端命令执行器。使用范围：根路由移动端分支。解耦评估：移动端 UI 操作由 mobile.ts 独立承接。 */
import { executeMobileGlobalCommand } from "./global/mobile";
/** 用途：引入桌面端命令执行器。使用范围：根路由桌面端分支。解耦评估：桌面端复杂布局命令由 desktop 子目录承接。 */
import { executeDesktopGlobalCommand } from "./global/desktop";
/** 用途：引入通用命令执行器。使用范围：根路由通用命令分支。解耦评估：跨平台命令由 common.ts 独立承接。 */
import { executeCommonGlobalCommand } from "./global/common";
/** 用途：引入应用实例类型。使用范围：保持 globalCommand 既有公共签名。解耦评估：类型通过 global/imports.ts 网关透传。 */
import type { AppFacade } from "./global/imports";
/** 用途：引入全局命令上下文类型。使用范围：构造分发上下文。解耦评估：复用 global/types.ts 契约。 */
import type { GlobalCommandContext } from "./global/types";
/** 根据当前平台和命令名解析根路由处理域。 */
const resolveGlobalCommandDomain = (command: string) => {
    // 移动端只处理移动端命令，桌面命令留给通用分支或未处理结果。
    if (isMobile && MOBILE_GLOBAL_COMMAND_VALUES.includes(command)) {
        return "mobile";
    }
    // 桌面端只处理桌面命令，移动端命令留给通用分支或未处理结果。
    if (!isMobile && DESKTOP_GLOBAL_COMMAND_VALUES.includes(command)) {
        return "desktop";
    }
    // 通用命令不区分平台，在平台专属命令未命中后统一处理。
    if (COMMON_GLOBAL_COMMAND_VALUES.includes(command)) {
        return "common";
    }
    return "unhandled";
};

/** 未识别命令保持原 globalCommand 返回 false 的语义。 */
const ignoreUnhandledGlobalCommand = () => false;

/** 根命令域路由，将平台状态和命令名解析结果映射到具体执行器。 */
const globalCommandRouter = calibur
    .universe(type({ domain: "string" }))
    .split(type({ domain: "'mobile'" }), () => executeMobileGlobalCommand)
    .split(type({ domain: "'desktop'" }), () => executeDesktopGlobalCommand)
    .split(type({ domain: "'common'" }), () => executeCommonGlobalCommand)
    .remain(() => ignoreUnhandledGlobalCommand)
    .build();

/**
 * 执行全局快捷命令。
 * @同步豁免: UI构建 - 该函数是既有同步公共入口，调用方依赖立即返回命令是否已处理。
 */
export const globalCommand = (command: string, app: AppFacade) => {
    const context: GlobalCommandContext<AppFacade> = {
        app,
        command,
    };
    const executor = globalCommandRouter({ domain: resolveGlobalCommandDomain(command) });
    return executor(context);
};
