/**
 * 用途：从 imports 转发布局导出工具，用于在 UI 重载前保存布局状态
 * 使用范围：仅在 triggerReload 函数中使用，用于在桌面端重载前导出布局配置
 * 解耦评估：无法通过依赖注入或参数传递替代，布局导出是应用状态管理的基础设施，必须直接导入
 */
import { exportLayout } from "./imports";
/**
 * 用途：从 imports 转发移动端判断工具，用于判断是否在移动端环境
 * 使用范围：仅在 triggerReload 函数中使用，用于判断是否在移动端执行不同的重载逻辑
 * 解耦评估：平台判断是基础设施能力，无法通过依赖注入替代
 */
import { isMobile } from "./imports";
/**
 * 用途：从 imports 转发消息隐藏工具，用于隐藏指定的消息提示
 * 使用范围：在 handleMessageCommand 和 createIgnoreDefenderExclusionHandler 中使用，用于关闭消息通知
 * 解耦评估：无法通过依赖注入或参数传递替代，消息对话框是 UI 基础设施，必须直接导入
 */
import { hideMessage } from "./imports";
/**
 * 用途：从 imports 转发消息显示工具，用于显示服务端推送的消息通知
 * 使用范围：在 handleMessageCommand 和 processMessage 中使用，用于展示各类提示和错误信息
 * 解耦评估：无法通过依赖注入或参数传递替代，消息对话框是 UI 基础设施，必须直接导入
 */
import { showMessage } from "./imports";
/**
 * 用途：从 imports 转发页面重载工具，用于在特定场景下刷新页面
 * 使用范围：在 triggerReload 和 handlePublishServiceClosed 中使用，用于重新加载应用
 * 解耦评估：页面重载是浏览器基础设施能力，无法通过依赖注入替代
 */
import { reloadLocation } from "./imports";
/**
 * 用途：从 imports 转发存储值设置工具，用于持久化配置到 localStorage
 * 使用范围：仅在 handleReloadUI 中使用，用于在重置滚动位置时保存文件位置记录
 * 解耦评估：无法通过依赖注入或参数传递替代，存储工具是应用状态持久化的基础设施，必须直接导入
 */
import { setStorageVal } from "./imports";
/**
 * 用途：从 imports 转发全局常量对象，用于访问应用配置常量
 * 使用范围：仅在 handleReloadUI 中使用，用于访问 LOCAL_FILEPOSITION 常量标识
 * 解耦评估：全局常量是基础设施配置，无法通过依赖注入替代
 */
import { Constants } from "./imports";
/**
 * 用途：从同目录导入 fetchPost 网络请求工具，用于向后端发送 POST 请求
 * 使用范围：在 createAddDefenderExclusionHandler 和 createIgnoreDefenderExclusionHandler 中使用，用于处理 Windows Defender 排除项相关请求
 * 解耦评估：可以通过依赖注入方式解耦，将 fetchPost 作为参数传入相关函数，但考虑到 fetchPost 是网络模块的核心基础设施且在同目录下，当前直接导入方式合理
 */
import { fetchPost } from "./fetch";
/**
 * 用途：从 imports 转发全局存储访问器，用于读写 window.siyuan.storage
 * 使用范围：仅在 handleReloadUI 中使用，用于在重置滚动位置时清空文件位置记录
 * 解耦评估：无法通过依赖注入或参数传递替代，全局存储是应用状态管理的基础设施，必须直接导入
 */
import { getSiyuanStorage } from "./imports";
/**
 * 用途：直接从 dialog/confirmDialog 导入确认对话框工具，用于 CronJob 鉴权时显示用户确认界面
 * 使用范围：仅在 cronjobAuthDependencies 依赖注入适配层中使用，传递给 handleCronjobAuthRequest
 * 解耦评估：已通过依赖注入方式解耦，confirmDialog 作为依赖对象传入 handleCronjobAuthRequest。
 * 不使用 ./imports 转发层是因为存在循环依赖链 processMessage → imports → dialog/confirmDialog → dialog/imports → fetch → imports，
 * Webpack 在循环依赖中返回未完成初始化的模块导出，导致 confirmDialog 为 undefined。
 */
import { confirmDialog } from "../../dialog/confirmDialog";
/**
 * 用途：从 imports 转发 WebSocket 连接获取器，用于向内核发送鉴权响应
 * 使用范围：仅在 sendCronjobAuthResponse 中使用，用于获取 WebSocket 连接并发送鉴权响应消息
 * 解耦评估：无法通过依赖注入或参数传递替代，WebSocket 连接是全局单例资源，必须直接导入
 */
import { getSiyuanWebSocket } from "./imports";
/**
 * 用途：从同目录导入 CronJob 鉴权请求处理器，用于处理服务端的鉴权请求
 * 使用范围：仅在 processMessage 的 cronjob_auth_request 命令分支中使用，用于处理 CronJob 鉴权流程
 * 解耦评估：无法通过依赖注入或参数传递替代，这是业务逻辑的核心处理函数，必须直接导入
 */
import { handleCronjobAuthRequest } from "./cronjobAuth";
/**
 * 用途：从 imports 转发浏览器环境判断工具，用于判断是否在浏览器环境
 * 使用范围：在 handlePublishServiceClosed 和 checkPublishServiceClosed 中使用，用于判断是否在浏览器环境执行发布服务关闭逻辑
 * 解耦评估：平台判断是基础设施能力，无法通过依赖注入替代
 */
import { isBrowser } from "./imports";

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
            allow
        }
    }));
};

const cronjobAuthDependencies = {
    confirmDialog,
    sendAuthResponse: sendCronjobAuthResponse
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
        handleCronjobAuthRequest(response.data, cronjobAuthDependencies);
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
export const checkPublishServiceClosed = () => {
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
