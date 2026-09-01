/**
 * 用途：从统一转发模块导入标签页实例查找功能
 * 使用范围：closeTab 函数中用于根据ID获取标签页实例
 * 解耦评估：依赖布局系统核心功能，当前无法解耦
 */
import { getInstanceById } from "./imports";

/**
 * 用途：从统一转发模块导入配置访问功能
 * 使用范围：lockScreenByMode 函数中用于读取锁屏模式配置
 * 解耦评估：依赖环境配置系统，当前无法解耦
 */
import { getSiyuanConfig } from "./imports";

/**
 * 用途：从统一转发模块导入锁屏功能
 * 使用范围：lockScreenByMode 和 onWindowsMsg 函数中用于执行锁屏操作
 * 解耦评估：@AIDONE 锁屏功能作为 IPC 消息处理的一部分直接调用 lockScreen，在当前架构下 lockScreen 已经是模块入口（imports.ts 转发），调用链为 IPC → onWindowsMsg → lockScreenByMode → lockScreen。若后续需要事件化解耦，可发射应用级锁屏事件由全局监听器处理。
 */
import { lockScreen } from "./imports";

/**
 * 用途：导入标签页拖拽预览清理功能，用于跨窗口拖拽结束后清理预览元素并复位拖拽状态
 * 使用范围：handleResetTabsStyle 函数的 rmDragStyle 分支
 * 解耦评估：布局拖拽领域功能，window/imports.ts 网关暂未转发，直接依赖实现模块
 */
import {clearTabDragPreview} from "../layout/tabDrag";
/**
 * 用途：导入 Electron 样式类型守卫，用于判断元素样式是否支持 WebkitAppRegion
 * 使用范围：handleResetTabsStyle 函数中用于类型安全的样式操作
 * 解耦评估：同目录模块，无需解耦
 */
import {isElectronStyle} from "./init.guard";
/** 用途：判断布局查询结果是否为完整页签。使用范围：关闭页签 IPC 分支。解耦评估：复用窗口域兼容守卫，不加载具体 Tab class。 */
import {isTab} from "./init.guard";

/**
 * 用途：从统一转发模块导入应用主类型定义
 * 使用范围：onWindowsMsg 和 lockScreenByMode 函数参数类型，用于访问应用实例
 * 解耦评估：AppFacade 是核心依赖，当前无法解耦
 */
import type { AppFacade } from "./imports";

/**
 * 关闭指定的标签页
 *
 * 作用：根据IPC消息中的标签页ID关闭对应的标签页
 * 意图：响应来自Electron主进程或其他窗口的关闭标签页请求
 * 调用时机：当接收到cmd为"closetab"的IPC消息时调用（见onWindowsMsg函数）
 *
 * @param ipcData - IPC消息数据，其中data字段包含要关闭的标签页ID
 */
const closeTab = (ipcData: IWebSocketData) => {
    const tab = getInstanceById(ipcData.data);
    if (!isTab(tab)) {
        return;
    }
    tab.parent.removeTab(ipcData.data);
};

/**
 * 重置标签页样式
 *
 * 作用：根据不同的命令重置标签页的拖拽样式或Electron窗口拖拽区域
 * 意图：处理标签页拖拽操作结束后的样式清理，以及Electron窗口标题栏拖拽区域的动态调整
 * 调用时机：当接收到cmd为"resetTabsStyle"的IPC消息时调用
 *
 * @param ipcData - IPC消息数据，data字段可能为"rmDragStyle"、"addRegionStyle"或"removeRegionStyle"
 */
const handleResetTabsStyle = (ipcData: IWebSocketData) => {
    // 移除拖拽样式：清理标签页拖拽残留样式与克隆页签、复位跨窗口拖拽状态，
    // 避免拖拽中断后残留预览 DOM 或指向已不存在页签的 dragTab 数据
    if (ipcData.data === "rmDragStyle") {
        clearTabDragPreview();
        window.siyuan.dragTab = undefined;
        return;
    }

    for (const item of document.querySelectorAll<HTMLElement>(".layout-tab-bar--readonly .fn__flex-1")) {
        const isTopMost = item.getBoundingClientRect().top <= 6;
        if (!isTopMost || !isElectronStyle(item.style)) {
            continue;
        }
        // 添加拖拽区域：将标签栏区域设置为可拖拽窗口的区域（Electron特性）
        if (ipcData.data === "addRegionStyle") {
            item.style.WebkitAppRegion = "drag";
        }
        // 移除拖拽区域：取消标签栏区域的窗口拖拽功能
        if (ipcData.data === "removeRegionStyle") {
            item.style.WebkitAppRegion = "";
        }
    }
};

/**
 * 根据配置的锁屏模式决定是否锁屏
 *
 * 作用：检查系统配置的锁屏模式，仅在模式为1时执行锁屏
 * 意图：提供条件锁屏功能，允许用户通过配置控制锁屏行为
 * 调用时机：当接收到cmd为"lockscreenByMode"的IPC消息时调用
 *
 * @param app - 应用实例，用于执行锁屏操作
 */
const lockScreenByMode = (app: AppFacade) => {
    // 检查锁屏模式：仅当系统配置的锁屏模式为1时才执行锁屏操作
    if (getSiyuanConfig().system.lockScreenMode === 1) {
        lockScreen(app);
    }
};

/**
 * 处理窗口相关的IPC消息
 *
 * 作用：根据IPC消息的命令类型分发到对应的处理函数
 * 意图：作为窗口消息的统一入口，处理来自Electron主进程或其他窗口的各类窗口操作请求
 * 调用时机：当接收到窗口相关的WebSocket/IPC消息时调用
 *
 * @同步豁免: 需要绝对同步的DOM访问 - IPC消息处理需要立即响应，涉及DOM操作和窗口状态同步更新
 *
 * @param ipcData - IPC消息数据，包含cmd命令和data数据
 * @param app - 应用实例，用于访问应用级别的功能
 */
export const onWindowsMsg = (ipcData: IWebSocketData, app: AppFacade) => {
    if (!ipcData.cmd) {
        return;
    }

    // 关闭标签页命令：处理来自其他窗口或主进程的关闭标签页请求
    if (ipcData.cmd === "closetab") {
        closeTab(ipcData);
        return;
    }

    // 跨窗口标签页拖拽数据：其他窗口把正在拖拽的页签信息广播过来，
    // 记录到全局 siyuan.dragTab 供本窗口放置逻辑使用（发送方见 layout/Tab.ts 的 setTabDragData 广播）
    if (ipcData.cmd === "setTabDragData") {
        window.siyuan.dragTab = ipcData.data as ITabDragData;
        return;
    }

    // 重置标签页样式命令：处理标签页拖拽样式清理或窗口拖拽区域调整
    if (ipcData.cmd === "resetTabsStyle") {
        handleResetTabsStyle(ipcData);
        return;
    }

    // 锁屏命令：立即执行锁屏操作
    if (ipcData.cmd === "lockscreen") {
        lockScreen(app);
        return;
    }

    // 条件锁屏命令：根据系统配置决定是否锁屏
    if (ipcData.cmd === "lockscreenByMode") {
        lockScreenByMode(app);
    }
};
