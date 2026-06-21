import { Constants } from "../../constants";
import { isBrowser, isMobile } from "../../platform";
import { getSiyuanStorage, getSiyuanWebSocket } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { reloadLocation } from "../siyuanEnvironments/windowLocation.environment";
import { handleCronjobAuthRequest } from "./cronjobAuth";
import type { IProcessMessageDependencies, IProcessMessageUIDependencies } from "./types";

let processMessageUIDependencies: Partial<IProcessMessageUIDependencies> = {};

export const setProcessMessageUIDependencies = (dependencies: IProcessMessageUIDependencies) => {
    processMessageUIDependencies = dependencies;
};

const resolveProcessMessageDependencies = (dependencies: IProcessMessageDependencies): IProcessMessageDependencies => ({
    ...processMessageUIDependencies,
    ...dependencies,
});

export const createProcessMessage = (dependencies: IProcessMessageDependencies) => (response: IWebSocketData) => {
    return processMessage(response, dependencies);
};

/** 触发 UI 重载 */
const triggerReload = (dependencies: IProcessMessageDependencies) => {
    if (isMobile || !dependencies.exportLayout) {
        reloadLocation();
        return;
    }
    void dependencies.exportLayout({
        cb() {
            reloadLocation();
        },
        errorExit: false,
    });
};

/** 保存本地存储值，避免 processMessage 静态依赖 protyle/util/compatibility */
const setStorageVal = (
    dependencies: IProcessMessageDependencies,
    key: string,
    val: unknown,
    cb?: () => void,
) => {
    if (window.siyuan.config.readonly || window.siyuan.isPublish) {
        return;
    }
    void dependencies.fetchPost("/api/storage/setLocalStorageVal", {
        app: Constants.SIYUAN_APPID,
        key,
        val,
    }, () => {
        cb?.();
    });
};

/** 处理添加 Windows Defender 排除项的点击事件 */
const createAddDefenderExclusionHandler = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => (event: Event) => {
    if (event.target instanceof Element) {
        event.target.innerHTML = '<svg class="fn__rotate" style="margin-right: 0;"><use xlink:href="#iconRefresh"></use></svg>';
    }
    void dependencies.fetchPost("/api/system/addMicrosoftDefenderExclusion", {}, () => {
        void dependencies.hideMessage?.(messageId);
    });
};

/** 处理忽略 Windows Defender 排除项的点击事件 */
const createIgnoreDefenderExclusionHandler = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => () => {
    void dependencies.hideMessage?.(messageId);
    void dependencies.fetchPost("/api/system/ignoreAddMicrosoftDefenderExclusion");
};

/** 绑定 Windows Defender 排除项相关的事件处理器 */
const bindDefenderExclusionHandlers = (
    dependencies: IProcessMessageDependencies,
    messageId: string,
) => {
    const addDefenderExclusion = document.querySelector("#message #addMicrosoftDefenderExclusion");
    addDefenderExclusion?.addEventListener("click", createAddDefenderExclusionHandler(dependencies, messageId), { once: true });
    const ignoreAddMicrosoftDefenderExclusion = document.querySelector("#message #ignoreAddMicrosoftDefenderExclusion");
    ignoreAddMicrosoftDefenderExclusion?.addEventListener("click", createIgnoreDefenderExclusionHandler(dependencies, messageId), { once: true });
};

/** 处理 msg 命令 */
const handleMessageCommand = (response: IWebSocketData, dependencies: IProcessMessageDependencies) => {
    const messageId = dependencies.showMessage?.(
        response.msg,
        response.data.closeTimeout,
        response.code === 0 ? "info" : "error",
        response.data.id,
    );
    if (!messageId) {
        return;
    }
    void Promise.resolve(messageId).then((id) => {
        if (id) {
            bindDefenderExclusionHandlers(dependencies, id);
        }
    });
};

/** 处理 UI 重载 */
const handleReloadUI = (response: IWebSocketData, dependencies: IProcessMessageDependencies) => {
    if (response.data?.resetScroll) {
        const storage = getSiyuanStorage();
        storage[Constants.LOCAL_FILEPOSITION] = {};
        setStorageVal(dependencies, Constants.LOCAL_FILEPOSITION, storage[Constants.LOCAL_FILEPOSITION], () => {
            triggerReload(dependencies);
        });
        return;
    }
    triggerReload(dependencies);
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
        return;
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

const handleCronjobAuthMessage = (
    response: IWebSocketData,
    dependencies: IProcessMessageDependencies,
) => {
    if (!dependencies.confirmDialog) {
        console.warn("[CronJob Auth] confirmDialog dependency is not registered");
        if (typeof response.data?.reqId === "string") {
            sendCronjobAuthResponse(response.data.reqId, false);
        }
        return;
    }
    console.log("[CronJob Auth] 收到鉴权请求:", response.data);
    handleCronjobAuthRequest(response.data, {
        confirmDialog: dependencies.confirmDialog,
        sendAuthResponse: sendCronjobAuthResponse,
    });
};

/** @同步豁免: 遗留代码 - 返回值在 fetch.ts 中被同步用于条件判断 `if (processMessage(response))`，改为 async 会导致 Promise 始终为 truthy 从而破坏分发逻辑 */
export const processMessage = (
    response: IWebSocketData,
    dependencies: IProcessMessageDependencies,
) => {
    const resolvedDependencies = resolveProcessMessageDependencies(dependencies);
    // 服务端推送消息通知，展示消息并绑定可能的操作按钮（如 Defender 排除项）
    if ("msg" === response.cmd) {
        handleMessageCommand(response, resolvedDependencies);
        return false;
    }
    // 服务端请求关闭指定消息，通过 data.id 定位并隐藏对应的消息提示
    if ("cmsg" === response.cmd) {
        void resolvedDependencies.hideMessage?.(response.data.id);
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
        handleReloadUI(response, resolvedDependencies);
        return false;
    }
    // 处理 CronJob 鉴权请求
    if ("cronjob_auth_request" === response.cmd) {
        handleCronjobAuthMessage(response, resolvedDependencies);
        return false;
    }
    // 服务端通知发布服务已关闭，在浏览器环境下保存关闭信息并重载页面
    if ("closepublishpage" === response.cmd) {
        handlePublishServiceClosed(response.msg);
        return false;
    }

    // 小于 0 为提示：-2 提示；-1 报错，大于 0 的错误需处理，等于 0 的为正常操作
    if (response.code < 0) {
        void resolvedDependencies.showMessage?.(
            response.msg,
            response.data ? (response.data.closeTimeout || 0) : 0,
            response.code === -1 ? "error" : "info",
        );
        return false;
    }

    return response;
};

/** @同步豁免: 需要绝对同步的DOM访问 - sessionStorage 写入必须在 reloadLocation 触发前完成以确保数据持久化，被 processMessage 同步调用链依赖 */
export const handlePublishServiceClosed = (msg: string) => {
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
