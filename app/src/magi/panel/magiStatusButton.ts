import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { 注册状态栏按钮 } from "../../registry/StatusBarRegistry";
import { Constants } from "../../constants";

/**
 * 打开 MAGI 窗口
 *
 * 作用：在 Electron 环境通过 IPC 请求主进程拉起 MAGI 窗口；浏览器环境打开独立页面。
 * 意图：提供统一的 MAGI 唤起入口，供状态栏按钮点击复用。
 * 调用时机：状态栏 MAGI 按钮点击时调用。
 */
export function 打开MAGI() {
    if (isElectron) {
        ipcSend(Constants.SIYUAN_OPEN_MAGI);
        return;
    }
    window.open(`/stage/build/magi-desktop/?r=${Date.now()}`, "_blank");
}

/**
 * 初始化 MAGI 状态栏按钮
 *
 * 作用：向状态栏注册一个 MAGI 入口按钮。
 * 意图：让用户能从主界面状态栏快速唤起 MAGI 窗口。
 * 调用时机：主应用初始化 S-Forge 面板入口时调用一次。
 */
export function 初始化MAGI状态栏按钮(): void {
    注册状态栏按钮({
        id: "MagiMonitor",
        icon: "iconSparkles",
        tooltip: "MAGI 监控台",
        onClick: 打开MAGI,
        position: "right",
        order: 45,
    });
}

export const initMagiStatusButton = 初始化MAGI状态栏按钮;
