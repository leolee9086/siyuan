import { exportLayout, getInstanceById } from "../layout/util";
import { Tab } from "../layout/Tab";
import { fetchPost } from "../util/network/fetch";
import { redirectToCheckAuth } from "../util/file/pathName";
import { isWindow } from "../util/platform/functions";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isElectronStyle } from "./setHeader.guard";

/**
 * 关闭指定的标签页
 *
 * @description
 * 作用：根据 IPC 消息中的 tab id 查找并关闭对应的标签页
 *
 * 意图：支持跨窗口/跨进程的标签页关闭操作，允许主进程或其他窗口
 *       通过 IPC 消息远程关闭当前窗口中的标签页
 *
 * 调用时机：当收到 'closetab' IPC 消息时被调用，
 *           通常在标签页拖拽到新窗口后关闭原窗口中的标签页
 *
 * @param ipcData - IPC 消息数据，data 字段包含要关闭的 tab id
 */
const closeTab = (ipcData: IWebSocketData) => {
    console.log("[closeTab] 收到 closetab 消息, tab id:", ipcData.data);
    const tab = getInstanceById(ipcData.data);
    console.log("[closeTab] getInstanceById 返回:", tab, "是否为 Tab:", tab instanceof Tab);
    // 验证获取到的实例确实是 Tab 类型，因为 getInstanceById 可能返回其他布局组件类型
    if (!tab || !(tab instanceof Tab)) {
        console.warn("[closeTab] 未找到对应的 tab 实例或不是 Tab 类型");
        return;
    }
    console.log("[closeTab] 开始移除 tab");
    tab.parent.removeTab(ipcData.data);
};
/**
 * 重置标签栏的拖拽和窗口区域样式
 *
 * @description
 * 作用：根据 IPC 消息类型，清除拖拽样式或设置/移除窗口拖拽区域
 *
 * 意图：在标签页拖拽操作的不同阶段，需要动态调整标签栏的样式：
 *       - 拖拽结束时清除拖拽视觉效果和克隆的标签元素
 *       - 在 Electron 窗口中，控制标签栏是否可作为窗口拖拽区域
 *
 * 调用时机：当收到 'resetTabsStyle' IPC 消息时被调用，
 *           通常在标签页拖拽操作的开始、结束或取消时触发
 *
 * @param ipcData - IPC 消息数据，data 字段指定操作类型：
 *                  - 'rmDragStyle': 移除拖拽样式和克隆元素
 *                  - 'addRegionStyle': 添加窗口拖拽区域
 *                  - 'removeRegionStyle': 移除窗口拖拽区域
 */
const handleResetTabsStyle = (ipcData: IWebSocketData) => {
    // 移除拖拽样式：清除拖拽过程中添加的视觉效果和临时克隆的标签元素
    if (ipcData.data === "rmDragStyle") {
        for (const item of document.querySelectorAll(".layout-tab-bars--drag")) {
            item.classList.remove("layout-tab-bars--drag");
        }
        for (const tabItem of document.querySelectorAll(".layout-tab-bar li[data-clone='true']")) {
            tabItem.remove();
        }
        return;
    }
    if (!isWindow()) {
        return;
    }
    for (const item of document.querySelectorAll<HTMLElement>(".layout-tab-bar--readonly .fn__flex-1")) {
        const isTopMost = item.getBoundingClientRect().top <= 0;
        if (!isTopMost || !isElectronStyle(item.style)) {
            continue;
        }
        // 添加窗口拖拽区域：使标签栏空白区域可用于拖动整个窗口
        if (ipcData.data === "addRegionStyle") {
            item.style.WebkitAppRegion = "drag";
        }
        // 移除窗口拖拽区域：在拖拽标签页时禁用窗口拖动，避免冲突
        if (ipcData.data === "removeRegionStyle") {
            item.style.WebkitAppRegion = "";
        }
    }
};

/**
 * 锁屏操作的导出布局配置
 *
 * @description
 * 作用：定义锁屏时导出布局的配置参数，包含布局导出完成后的回调逻辑
 *
 * 意图：将锁屏配置抽取为常量，避免 trivial wrapper 函数，
 *       同时保持代码的可读性和可维护性
 *
 * 使用场景：
 *   - 'lockscreen' 消息：用户主动锁屏时使用
 *   - 'lockscreenByMode' 消息：系统休眠触发时条件性使用
 */
const LOCKSCREEN_EXPORT_CONFIG = {
    errorExit: false,
    /** 布局导出完成后的回调：执行登出并重定向到认证页面 */
    cb() {
        fetchPost("/api/system/logoutAuth", {}, () => {
            redirectToCheckAuth();
        });
    }
} as const;

/**
 * 根据锁屏模式配置条件性执行锁屏操作
 *
 * @description
 * 作用：检查系统锁屏模式配置，仅在特定模式下触发锁屏
 *
 * 意图：思源笔记支持多种锁屏触发方式，此函数用于处理"按模式锁屏"的场景，
 *       允许用户通过配置控制是否响应某些锁屏触发事件（如系统休眠唤醒）
 *
 * 调用时机：当收到 'lockscreenByMode' IPC 消息时被调用，
 *           通常由 Electron 主进程在系统事件（如休眠唤醒）时发送
 *
 * @see {@link LOCKSCREEN_EXPORT_CONFIG} 锁屏导出配置
 * @see {@link windowsMsgHandlers} 消息处理器注册表
 */
const handleLockscreenByMode = () => {
    // 仅当 lockScreenMode 为 1（跟随系统休眠）时执行锁屏
    // lockScreenMode 值含义：0 = 手动锁屏，1 = 跟随系统休眠自动锁屏
    if (getSiyuanConfig().system.lockScreenMode === 1) {
        exportLayout(LOCKSCREEN_EXPORT_CONFIG);
    }
};

const windowsMsgHandlers: Record<string, (ipcData: IWebSocketData) => void> = {
    closetab: closeTab,
    resetTabsStyle: handleResetTabsStyle,
    /** 直接锁屏：用户主动触发，立即执行锁屏流程 */
    lockscreen: () => exportLayout(LOCKSCREEN_EXPORT_CONFIG),
    lockscreenByMode: handleLockscreenByMode,
};

/**
 * Windows IPC 消息分发入口
 *
 * @description
 * 作用：接收 IPC 消息并分发到对应的处理函数
 *
 * 意图：作为渲染进程接收 Electron 主进程消息的统一入口，
 *       通过消息类型路由到具体的处理逻辑，实现进程间通信
 *
 * 调用时机：当 WebSocket 或 IPC 通道收到来自主进程的消息时被调用，
 *           通常在应用初始化时注册为消息监听器
 *
 * @param ipcData - IPC 消息数据，cmd 字段指定消息类型
 *
 * @同步豁免: 遗留代码 - 此函数作为 IPC 消息处理器被外部同步调用，
 *           修改为异步需要同时修改所有调用方，影响范围较大
 */
export const onWindowsMsg = (ipcData: IWebSocketData) => {
    if (!ipcData.cmd) {
        return;
    }
    windowsMsgHandlers[ipcData.cmd]?.(ipcData);
};
