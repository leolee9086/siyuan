/**
 * 用途：通过同层转发层获取窗口按键模块所需依赖，避免业务文件直接使用父级路径导入。
 * 使用范围：仅供当前文件执行全局快捷键注销流程时使用。
 * 解耦评估：该文件仍依赖 AppFacade、IPC 与环境配置；先通过本地 `imports.ts` 收敛耦合，后续若改为依赖注入，可只调整转发层。
 */
import type { AppFacade } from "./imports";
/**
 * 用途：读取 IPC 常量，构造发送到主进程的快捷键注销命令。
 * 使用范围：仅用于当前文件内的 `unregisterGlobalShortcut` IPC 消息体构建。
 * 解耦评估：常量属于基础设施边界，当前调用链无法通过参数传递消除该依赖，经同层转发层引用已是较低耦合形式。
 */
import { Constants } from "./imports";
/**
 * 用途：安全读取思源配置，避免配置尚未初始化时直接访问全局对象。
 * 使用范围：仅用于读取主窗口全局快捷键 `toggleWin` 的当前自定义键位。
 * 解耦评估：配置读取理论上可由调用方显式传入，但当前该函数定位为快捷键回收入口，经 environment 与本地转发层访问更符合现有架构。
 */
import { getSafeSiyuanConfig } from "./imports";
/**
 * 用途：向 Electron 主进程发送快捷键注销命令。
 * 使用范围：仅用于当前文件内部的全局快捷键注销流程。
 * 解耦评估：IPC 能力与 Electron 平台强绑定，当前无法在不改变架构的前提下进一步解耦，通过同层转发层引用已收敛路径耦合。
 */
import { ipcSend } from "./imports";
/**
 * 作用：向 Electron 主进程发送单个全局快捷键的注销命令。
 * 意图：把 IPC 发送与空快捷键过滤逻辑收敛到单一入口，避免重复分支并防止将空值发送给主进程。
 * 调用时机：在注销主窗口快捷键和插件命令快捷键时统一调用。
 * 问题/改进：当前仅做空字符串过滤，若后续需要记录注销失败或去重，可在此处继续扩展。
 */
const unregisterGlobalShortcut = (accelerator: string | undefined) => {
    if (!accelerator?.trim()) {
        return;
    }
    ipcSend(Constants.SIYUAN_CMD, {
        cmd: "unregisterGlobalShortcut",
        accelerator,
    });
};

/**
 * 作用：遍历应用内所有插件命令并注销具备全局回调能力的快捷键。
 * 意图：将插件命令遍历逻辑从导出函数中拆出，降低入口复杂度并规避 `forEach` 与超长内联回调 lint 规则。
 * 调用时机：窗口级全局快捷键整体注销流程执行时，在主窗口快捷键处理后调用。
 * 问题/改进：当前按原始注册顺序逐一注销，若未来主进程支持批量注销，可进一步合并 IPC 调用以减少消息数量。
 */
const unregisterPluginGlobalShortcuts = (app: AppFacade) => {
    for (const plugin of app.plugins) {
        for (const command of plugin.commands) {
            if (!command.globalCallback) {
                continue;
            }
            unregisterGlobalShortcut(command.customHotkey);
        }
    }
};

/**
 * 作用：注销当前窗口及插件命令注册到 Electron 主进程的全部全局快捷键。
 * 意图：在键位变更、窗口退出或相关生命周期收尾阶段统一回收全局快捷键，避免主进程残留失效注册。
 * 调用时机：窗口级快捷键系统需要撤销全局快捷键绑定时调用，例如重新注册前的清理流程。
 * 问题/改进：当前仍按单条 IPC 消息逐个注销；若后续发现插件数量较多导致消息频繁，可演进为批量协议。
 * 注意：调用方（状态空间）需确保仅在 Electron 环境下调用此函数。
 * @AIDONE isElectron 已从执行器移除，由调用方（keymap.ts 中已存在 isElectron 守卫）负责平台判断。
 */
export const sendUnregisterGlobalShortcut = async (app: AppFacade) => {
    const toggleWindowHotkey = getSafeSiyuanConfig()?.keymap.general.toggleWin.custom;
    unregisterGlobalShortcut(toggleWindowHotkey);
    unregisterPluginGlobalShortcuts(app);
};
