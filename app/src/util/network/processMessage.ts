/** 用途：消息命令涉及的存储键和应用 ID。使用范围：本模块消息分发；解耦评估：经本层 imports.ts 直达唯一协议常量。 */
import {Constants} from "./imports";
/** 用途：判断浏览器宿主。使用范围：发布服务关闭消息；解耦评估：经本层 imports.ts 直达平台事实。 */
import {isBrowser} from "./imports";
/** 用途：判断移动宿主。使用范围：UI 重载消息；解耦评估：经本层 imports.ts 直达平台事实。 */
import {isMobile} from "./imports";
/** 用途：取得当前阶段必有配置。使用范围：持久化消息状态前；解耦评估：抛错访问器显式维护生命周期前置条件。 */
import {getSiyuanConfig} from "./imports";
/** 用途：取得当前阶段必有本地存储。使用范围：重置滚动位置消息；解耦评估：抛错访问器显式维护生命周期前置条件。 */
import {getSiyuanStorage} from "./imports";
/** 用途：取得内核 WebSocket。使用范围：CronJob 鉴权响应；解耦评估：环境访问器保持连接所有权。 */
import {getSiyuanWebSocket} from "./imports";
/** 用途：执行宿主页面重载。使用范围：UI 重载及发布关闭；解耦评估：location 环境能力保持可测试边界。 */
import {reloadLocation} from "./imports";
/** 用途：读取内核消息 UI 依赖。使用范围：每次消息分发；解耦评估：统一注册表替代模块级可变状态。 */
import {getSForgeState} from "./imports";
/** 用途：登记内核消息 UI 依赖。使用范围：应用组合根启动；解耦评估：统一注册表替代模块级可变状态。 */
import {setSForgeState} from "./imports";
/** 用途：定位内核消息 UI 依赖。使用范围：注册与读取同一能力槽；解耦评估：命名 Symbol 保证跨入口身份稳定。 */
import {PROCESS_MESSAGE_UI_DEPENDENCIES} from "./imports";
/** 用途：显示 CronJob 人在回路确认。使用范围：对应 WebSocket 命令；解耦评估：同网络领域命令处理器直接复用。 */
import { handleCronjobAuthRequest } from "./cronjobAuth";
/** 用途：单次消息分发依赖。使用范围：本模块所有处理函数；解耦评估：同领域完整依赖类型。 */
import type {IProcessMessageDependencies} from "./types";
/** 用途：应用宿主登记的完整 UI 依赖。使用范围：注册表值；解耦评估：同领域完整依赖类型。 */
import type {IProcessMessageUIDependencies} from "./types";

/** @同步豁免: 生命周期 - 组合根必须在任何内核消息处理器可用前原子登记完整 UI 依赖。 */
// @柯里化 固定内核消息 UI 依赖注册槽，组合根只提供完整能力值。
export const setProcessMessageUIDependencies = (dependencies: IProcessMessageUIDependencies) => {
    setSForgeState(PROCESS_MESSAGE_UI_DEPENDENCIES, dependencies);
};

/** 合并组合根登记的 UI 能力与当前网络实现；单次调用依赖具有更高优先级。 */
const resolveProcessMessageDependencies = (dependencies: IProcessMessageDependencies) => ({
    ...getSForgeState(PROCESS_MESSAGE_UI_DEPENDENCIES),
    ...dependencies,
});

/** @同步豁免: 生命周期 - 组合根必须同步取得已绑定依赖的消息处理函数，再交给 Model 注册表。 */
export const createProcessMessage = (dependencies: IProcessMessageDependencies) => (response: IWebSocketData) => {
    return processMessage(response, dependencies);
};

/** 触发 UI 重载 */
const triggerReload = async (dependencies: IProcessMessageDependencies) => {
    // 移动宿主和未登记布局导出能力的独立宿主直接重载，完整桌面宿主先保存布局。
    if (isMobile || !dependencies.exportLayout) {
        reloadLocation();
        return;
    }
    await dependencies.exportLayout({
        /** 布局保存完成后继续既有重载动作。 */
        cb: reloadLocation,
        errorExit: false,
    });
};

/** 保存本地存储值，避免 processMessage 静态依赖 protyle/util/compatibility */
const setStorageVal = async (options: {
    dependencies: IProcessMessageDependencies;
    key: string;
    value: unknown;
    onStored?: () => void | Promise<void>;
}) => {
    const config = getSiyuanConfig();
    if (config.readonly || window.siyuan.isPublish) {
        return;
    }
    await options.dependencies.fetchPost("/api/storage/setLocalStorageVal", {
        app: Constants.SIYUAN_APPID,
        key: options.key,
        val: options.value,
    }, async () => {
        await options.onStored?.();
    });
};

/** 处理添加 Windows Defender 排除项的点击事件 */
const createAddDefenderExclusionHandler = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => async (event: Event) => {
    // 只有元素触发的真实点击具有可替换的按钮内容，程序化事件仍继续执行命令。
    if (event.target instanceof Element) {
        event.target.innerHTML = '<svg class="fn__rotate" style="margin-right: 0;"><use xlink:href="#iconRefresh"></use></svg>';
    }
    await dependencies.fetchPost("/api/system/addMicrosoftDefenderExclusion", {}, async () => {
        await dependencies.hideMessage?.(messageId);
    });
};

/** 处理忽略 Windows Defender 排除项的点击事件 */
const createIgnoreDefenderExclusionHandler = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => async () => {
    await dependencies.hideMessage?.(messageId);
    await dependencies.fetchPost("/api/system/ignoreAddMicrosoftDefenderExclusion");
};

/** 观察事件触发的异步命令失败，并保持后续消息与交互仍可继续。 */
const observeMessageAction = (action: Promise<void>, name: string) => {
    void action.catch((error: unknown) => {
        console.error(`[processMessage] ${name} failed`, error);
    });
};

/** 绑定 Windows Defender 排除项相关的事件处理器 */
const bindDefenderExclusionHandlers = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => {
    const addDefenderExclusion = document.querySelector("#message #addMicrosoftDefenderExclusion");
    addDefenderExclusion?.addEventListener("click", (event) => {
        observeMessageAction(createAddDefenderExclusionHandler(dependencies, messageId)(event), "add defender exclusion");
    }, { once: true });
    const ignoreAddMicrosoftDefenderExclusion = document.querySelector("#message #ignoreAddMicrosoftDefenderExclusion");
    ignoreAddMicrosoftDefenderExclusion?.addEventListener("click", () => {
        observeMessageAction(createIgnoreDefenderExclusionHandler(dependencies, messageId)(), "ignore defender exclusion");
    }, { once: true });
};

/** 处理 msg 命令 */
const handleMessageCommand = async (response: IWebSocketData, dependencies: IProcessMessageDependencies) => {
    const messageId = await dependencies.showMessage?.(
        response.msg,
        response.data.closeTimeout,
        response.code === 0 ? "info" : "error",
        response.data.id,
    );
    if (!messageId) {
        return;
    }
    bindDefenderExclusionHandlers(dependencies, messageId);
};

/** 处理 UI 重载 */
const handleReloadUI = async (response: IWebSocketData, dependencies: IProcessMessageDependencies) => {
    // resetScroll 要求先清除并持久化文件位置，随后才执行与普通 reloadui 相同的重载流程。
    if (response.data?.resetScroll) {
        const storage = getSiyuanStorage();
        storage[Constants.LOCAL_FILEPOSITION] = {};
        await setStorageVal({
            dependencies,
            key: Constants.LOCAL_FILEPOSITION,
            value: storage[Constants.LOCAL_FILEPOSITION],
            // 只在存储接口确认成功后继续等待布局保存与页面重载。
            onStored: triggerReload.bind(undefined, dependencies),
        });
        return;
    }
    await triggerReload(dependencies);
};

/**
 * CronJob 鉴权响应发送端口实现
 *
 * 作用：将用户授权结果通过现有 WebSocket 连接发送给内核。
 * 意图：把连接获取与发送细节封装在调用侧，避免业务模块耦合全局资源。
 */
const sendCronjobAuthResponse = (reqId: string, allow: boolean) => {
    const siyuanWs = getSiyuanWebSocket();
    const ws = siyuanWs?.ws;
    if (!ws) {
        throw new Error(`[CronJob Auth] response WebSocket is not available for request ${reqId}`);
    }
    ws.send(JSON.stringify({
        cmd: "cronjob_auth_response",
        reqId: Date.now(),
        param: {
            reqId,
            allow,
        },
    }));
};

/** 在确认能力缺失时显式记录错误，并尽可能向内核发送拒绝结果。 */
const rejectCronjobAuthWithoutDialog = (response: IWebSocketData) => {
    console.warn("[CronJob Auth] confirmDialog dependency is not registered");
    const reqId = response.data?.reqId;
    // 只有内核提供可关联的字符串请求 ID 时才能返回确定的拒绝响应。
    if (typeof reqId === "string") {
        sendCronjobAuthResponse(reqId, false);
    }
};

/** 校验宿主确认能力后展示 CronJob 鉴权界面；缺失能力时执行显式拒绝。 */
const handleCronjobAuthMessage = (
    response: IWebSocketData,
    dependencies: IProcessMessageDependencies,
) => {
    if (!dependencies.confirmDialog) {
        rejectCronjobAuthWithoutDialog(response);
        return;
    }
    console.log("[CronJob Auth] 收到鉴权请求:", response.data);
    handleCronjobAuthRequest(response.data, {
        confirmDialog: dependencies.confirmDialog,
        sendAuthResponse: sendCronjobAuthResponse,
    });
};

/** 按顺序处理内核消息及其异步宿主副作用，并返回是否继续交给业务回调。 */
export const processMessage = async (
    response: IWebSocketData,
    dependencies: IProcessMessageDependencies,
) => {
    const resolvedDependencies = resolveProcessMessageDependencies(dependencies);
    // 服务端推送消息通知，展示消息并绑定可能的操作按钮（如 Defender 排除项）
    if ("msg" === response.cmd) {
        await handleMessageCommand(response, resolvedDependencies);
        return false;
    }
    // 服务端请求关闭指定消息，通过 data.id 定位并隐藏对应的消息提示
    if ("cmsg" === response.cmd) {
        await resolvedDependencies.hideMessage?.(response.data.id);
        return false;
    }
    // 服务端通知进度条结束，移除页面上的进度条 DOM 元素
    if ("cprogress" === response.cmd) {
        const progress = document.getElementById("progress");
        progress?.remove();
        return false;
    }
    // 服务端要求重载 UI，可能伴随滚动位置重置
    if ("reloadui" === response.cmd) {
        await handleReloadUI(response, resolvedDependencies);
        return false;
    }
    // 处理 CronJob 鉴权请求
    if ("cronjob_auth_request" === response.cmd) {
        handleCronjobAuthMessage(response, resolvedDependencies);
        return false;
    }
    // 发布页面收到内容刷新通知时立即重载；普通应用页面只消费命令。
    if ("reloadpublishpage" === response.cmd) {
        if (window.siyuan.isPublish) {
            reloadLocation();
        }
        return false;
    }
    // 服务端通知发布服务已关闭，在浏览器环境下保存关闭信息并重载页面
    if ("closepublishpage" === response.cmd) {
        await handlePublishServiceClosed(response.msg);
        return false;
    }

    // 小于 0 为提示：-2 提示；-1 报错，大于 0 的错误需处理，等于 0 的为正常操作
    if (response.code < 0) {
        await resolvedDependencies.showMessage?.(
            response.msg,
            response.data ? (response.data.closeTimeout || 0) : 0,
            response.code === -1 ? "error" : "info",
        );
        return false;
    }

    return response;
};

/** 异步处理发布服务关闭通知；存储写入仍先于同一函数中的页面重载。 */
export const handlePublishServiceClosed = async (msg: string) => {
    // 仅在浏览器环境下执行，桌面端由主进程处理发布服务关闭
    if (isBrowser) {
        sessionStorage.setItem("siyuanPublishServiceClosed", msg || "");
        reloadLocation();
    }
};

/** @同步豁免: 需要绝对同步的DOM访问 - 在 App/Mobile 构造函数中同步调用以阻断后续初始化，需同步读取 sessionStorage 并替换 document.body 内容 */
export const checkPublishServiceClosed = () => {
    if (!isBrowser) {
        return false;
    }
    const publishServiceClosedMsg = sessionStorage.getItem("siyuanPublishServiceClosed");
    if (!publishServiceClosedMsg) {
        return false;
    }
    sessionStorage.removeItem("siyuanPublishServiceClosed");
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh">${publishServiceClosedMsg}</div>`;
    return true;
};
