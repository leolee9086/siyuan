import { exportLayout } from "../../layout/util";
import { isMobile } from "../../platform";
import { hideMessage, showMessage } from "../../dialog/message";
import { reloadLocation } from "../siyuanEnvironments/windowLocation.environment";
import { setStorageVal } from "../../protyle/util/compatibility";
import { Constants } from "../../constants";
import { fetchPost } from "./fetch";
import { getSiyuanStorage } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { handleCronjobAuthRequest } from "./cronjobAuth";
import { isBrowser } from "../platform/functions";

/** 触发 UI 重载 */
const triggerReload = () => {
    if (isMobile) {
        reloadLocation();
        return;
    }
    exportLayout({
        /** 导出布局后的回调 */
        cb() {
            reloadLocation();
        },
        errorExit: false,
    });
};

/** 处理添加 Windows Defender 排除项的点击事件 */
const createAddDefenderExclusionHandler = (messageId: string) => (event: Event) => {
    // event.target 类型为 EventTarget | null，需要通过 instanceof 收窄为 Element 才能安全访问 innerHTML，将按钮替换为旋转加载图标
    if (event.target instanceof Element) {
        event.target.innerHTML = '<svg class="fn__rotate" style="margin-right: 0;"><use xlink:href="#iconRefresh"></use></svg>';
    }
    fetchPost("/api/system/addMicrosoftDefenderExclusion", {}, () => {
        hideMessage(messageId);
    });
};

/** 处理忽略 Windows Defender 排除项的点击事件 */
const createIgnoreDefenderExclusionHandler = (messageId: string) => () => {
    hideMessage(messageId);
    fetchPost("/api/system/ignoreAddMicrosoftDefenderExclusion");
};

/** 绑定 Windows Defender 排除项相关的事件处理器 */
const bindDefenderExclusionHandlers = (messageId: string) => {
    const addDefenderExclusion = document.querySelector("#message #addMicrosoftDefenderExclusion");
    addDefenderExclusion?.addEventListener("click", createAddDefenderExclusionHandler(messageId), { once: true });
    const ignoreAddMicrosoftDefenderExclusion = document.querySelector("#message #ignoreAddMicrosoftDefenderExclusion");
    ignoreAddMicrosoftDefenderExclusion?.addEventListener("click", createIgnoreDefenderExclusionHandler(messageId), { once: true });
};

/** 处理 msg 命令 */
const handleMessageCommand = (response: IWebSocketData) => {
    const id = showMessage(response.msg, response.data.closeTimeout, response.code === 0 ? "info" : "error", response.data.id);
    if (!id) {
        return;
    }
    bindDefenderExclusionHandlers(id);
};


/** 处理 UI 重载 */
const handleReloadUI = (response: IWebSocketData) => {
    // 当服务端指示需要重置滚动位置时，先清空文件位置记录再重载
    if (response.data?.resetScroll) {
        getSiyuanStorage()[Constants.LOCAL_FILEPOSITION] = {};
        setStorageVal(Constants.LOCAL_FILEPOSITION, getSiyuanStorage()[Constants.LOCAL_FILEPOSITION], triggerReload);
        return;
    }
    triggerReload();
};

/** @同步豁免: 遗留代码 - 返回值在 fetch.ts 中被同步用于条件判断 `if (processMessage(response))`，改为 async 会导致 Promise 始终为 truthy 从而破坏分发逻辑 */
export const processMessage = (response: IWebSocketData) => {
    // 服务端推送消息通知，展示消息并绑定可能的操作按钮（如 Defender 排除项）
    if ("msg" === response.cmd) {
        handleMessageCommand(response);
        return false;
    }
    // 服务端请求关闭指定消息，通过 data.id 定位并隐藏对应的消息提示
    if ("cmsg" === response.cmd) {
        hideMessage(response.data.id);
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
        handleReloadUI(response);
        return false;
    }
    // 处理 CronJob 鉴权请求
    if ("cronjob_auth_request" === response.cmd) {
        console.log("[CronJob Auth] 收到鉴权请求:", response.data);
        handleCronjobAuthRequest(response.data);
        return false;
    }
    // 服务端通知发布服务已关闭，在浏览器环境下保存关闭信息并重载页面
    if ("closepublishpage" === response.cmd) {
        handlePublishServiceClosed(response.msg);
        return false;
    }

    // 小于 0 为提示：-2 提示；-1 报错，大于 0 的错误需处理，等于 0 的为正常操作
    if (response.code < 0) {
        showMessage(response.msg, response.data ? (response.data.closeTimeout || 0) : 0, response.code === -1 ? "error" : "info");
        return false;
    }

    return response;
};

/** @同步豁免: 需要绝对同步的DOM访问 - sessionStorage 写入必须在 reloadLocation 触发前完成以确保数据持久化，被 processMessage 同步调用链依赖 */
export const handlePublishServiceClosed = (msg: string) => {
    // 仅在浏览器环境下执行，桌面端由主进程处理发布服务关闭
    if (isBrowser()) {
        sessionStorage.setItem("siyuanPublishServiceClosed", msg || "");
        reloadLocation();
    }
};

/** @同步豁免: 需要绝对同步的DOM访问 - 在 App/Mobile 构造函数中同步调用以阻断后续初始化，需同步读取 sessionStorage 并替换 document.body 内容 */
export const checkPublishServiceClosed = (): boolean => {
    if (!isBrowser()) {
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
