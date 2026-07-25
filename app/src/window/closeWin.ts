/**
 * 用途：引入 AppFacade 类型定义，用于窗口关闭函数的参数类型标注
 * 使用范围：closeWindow 函数参数类型声明
 * 解耦评估：AppFacade 是核心应用类型，当前无法解耦
 */
import type { AppFacade } from "./imports";

/**
 * 用途：引入常量定义，用于窗口关闭流程
 * 使用范围：closeWindow 函数中向主进程发送销毁窗口命令
 * 解耦评估：Constants 是核心依赖，当前无法解耦；ipcSend 已通过参数注入解耦
 */
import { Constants } from "./imports";

/**
 * 关闭独立窗口前的清理操作
 *
 * 作用：依次卸载所有插件，然后通知主进程销毁当前窗口
 * 意图：确保插件有机会执行清理逻辑（如保存状态），避免资源泄漏
 * 调用时机：用户关闭独立窗口时由窗口事件触发
 * @param app 应用实例，用于访问插件列表
 * @param sendIpc IPC 通信函数，用于向主进程发送销毁窗口命令
 */
export const closeWindow = async (
    app: AppFacade,
    sendIpc: (cmd: string, msg: string) => void
) => {
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
        try {
            await plugin.kernel?.destroy();
        } catch (e) {
            console.error(e);
        }
    }
    sendIpc(Constants.SIYUAN_CMD, "destroy");
};
