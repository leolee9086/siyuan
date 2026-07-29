/**
 * 用途：同步当前窗口和插件命令的全局快捷键到 Electron 主进程。
 * 使用范围：供 `onGetConfig.ts`、`commonHotkey.ts` 和键位设置模块在需要重新注册全局快捷键时调用。
 * 替代关系：本模块的 `sendGlobalShortcut` 是原 `boot/globalEvent/keydown.ts` 同名导出的唯一现行入口。
 * 解耦评估：当前流程仍直接依赖 Electron IPC 与思源环境配置；把它收敛成独立模块并通过本地网关读取环境，已经比继续留在庞大入口文件中更低耦合。
 */

/**
 * 用途：引入应用实例类型。
 * 使用范围：仅用于当前导出函数的入参标注。
 * 解耦评估：纯类型依赖，不形成运行时耦合；经同层网关复用即可。
 */
import type { AppFacade } from "./imports";

/**
 * 用途：引入 IPC 通道常量。
 * 使用范围：仅用于当前文件构造发送到主进程的快捷键同步消息。
 * 解耦评估：常量属于基础设施契约，不应在当前文件重复硬编码。
 */
import { Constants } from "./imports";

/**
 * 用途：引入配置读取函数。
 * 使用范围：仅用于当前文件读取当前窗口需要注册的全局快捷键配置。
 * 解耦评估：环境读取已经封装为稳定 accessor，继续复用即可。
 */
import { getSiyuanConfig } from "./imports";

/**
 * 用途：引入原始语言对象读取函数。
 * 使用范围：仅用于当前文件构造可被 IPC 结构化克隆的托盘语言数据。
 * 解耦评估：环境读取已经封装为稳定 accessor，继续复用即可。
 */
import { getSiyuanLanguages } from "./imports";

/**
 * 用途：引入 IPC 发送函数。
 * 使用范围：仅用于当前文件向 Electron 主进程发送快捷键同步命令。
 * 解耦评估：IPC 是基础设施边界，当前直接依赖风险最低。
 */
import { ipcSend } from "./imports";

/**
 * 作用：收集当前窗口和插件命令需要注册到主进程的全局快捷键列表。
 * 意图：把快捷键收集从导出函数中拆出，避免入口同时承担平台判断与遍历细节。
 * 调用时机：仅在 Electron 环境下、准备向主进程发送全局快捷键同步消息时调用。
 * 问题/改进：当前仍按插件原始注册顺序逐条收集；若未来需要冲突诊断，可在此补充去重和告警。
 */
const appendGlobalHotkey = (hotkeys: string[], hotkey: string | undefined) => {
    if (!hotkey?.trim()) {
        return;
    }
    hotkeys.push(hotkey);
};

/**
 * 作用：收集当前窗口与插件命令中有效的全局快捷键字符串列表。
 * 意图：把快捷键有效性校验与遍历逻辑集中到单一位置，避免调用方接收到 `undefined` 或空白快捷键。
 * 调用时机：仅在 `sendGlobalShortcut` 准备向 Electron 主进程同步快捷键时调用。
 * 问题/改进：当前仅过滤空值与空白字符串，尚未去重；若未来主进程需要更稳定的注册顺序或冲突提示，可在此加入去重与诊断。
 */
const collectGlobalHotkeys = (app: AppFacade) => {
    const hotkeys: string[] = [];
    appendGlobalHotkey(hotkeys, getSiyuanConfig().keymap.general.toggleWin.custom);
    for (const plugin of app.plugins) {
        for (const command of plugin.commands) {
            if (!command.globalCallback) {
                continue;
            }
            appendGlobalHotkey(hotkeys, command.customHotkey);
        }
    }
    return hotkeys;
};

/**
 * 作用：把当前窗口级全局快捷键配置发送到 Electron 主进程。
 * 意图：将原来耦合在 `windowKeyDown.ts` 内的快捷键同步逻辑独立出来，让主入口只负责窗口键盘事件分发。
 * 调用时机：在配置加载完成、热键修正后或用户更新键位配置时调用。
 * 问题/改进：当前仍以一次性全量同步的方式发送；若未来快捷键更新变得频繁，可考虑增量同步协议。
 * 注意：调用方（状态空间）需确保仅在 Electron 环境下调用此函数。
 */
// @柯里化 该函数封装了热键收集(getSiyuanLanguages/collectGlobalHotkeys)与 IPC 发送的完整编排逻辑，非简单包装
export const sendGlobalShortcut = async (app: AppFacade) => {
    ipcSend(Constants.SIYUAN_HOTKEY, {
        languages: getSiyuanLanguages()["_trayMenu"],
        hotkeys: collectGlobalHotkeys(app),
    });
};
