import { App } from "../index";
import { Constants } from "../constants";
import { ipcSend } from "../platform/electron/ipcRenderer";

/**
 * 关闭独立窗口前的清理操作
 *
 * 作用：依次卸载所有插件，然后通知主进程销毁当前窗口
 * 意图：确保插件有机会执行清理逻辑（如保存状态），避免资源泄漏
 * 调用时机：用户关闭独立窗口时由窗口事件触发
 */
export const closeWindow = async (app: App) => {
    for (let i = 0; i < app.plugins.length; i++) {
        const plugin = app.plugins[i];
        if (!plugin) {
            continue;
        }
        try {
            await plugin.onunload();
        } catch (e) {
            console.error(e);
        }
    }
    ipcSend(Constants.SIYUAN_CMD, "destroy");
};
