import { computed, type ComputedRef } from "vue";
import { isElectron, isMobile } from "../../../platform";
import { ipcInvoke, ipcSend } from "../../../platform/electron/ipcRenderer";
import { Constants } from "../../../constants";

/** @同步豁免: UI构建 — setup 阶段需同步返回计算属性 */
/** 仅在 Electron 桌面端显示窗口控制按钮 */
export function createShowWindowControls(): ComputedRef<boolean> {
    return computed(() => isElectron && !isMobile);
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建控制台按钮事件处理器 */
export function createOpenConsoleHandler(): () => Promise<void> {
    return async () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "openDevTools");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建窗口最小化处理器 */
export function createMinimizeWindowHandler(): () => void {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "minimize");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建窗口最大化/还原切换处理器 */
export function createToggleMaximizeWindowHandler(): () => Promise<void> {
    return async () => {
        if (!isElectron) {
            return;
        }
        const isMaximized = await ipcInvoke<boolean>(Constants.SIYUAN_GET, {
            cmd: "isMaximized",
        });
        ipcSend(Constants.SIYUAN_CMD, isMaximized ? "restore" : "maximize");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建窗口关闭处理器 */
export function createCloseWindowHandler(): () => void {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "closeButtonBehavior");
    };
}
