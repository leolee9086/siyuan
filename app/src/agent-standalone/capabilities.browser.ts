/** 用途：处理独立页消息富内容；使用范围：仅浏览器 capability；解耦评估：经目录网关取得并通过 ContentRenderPort 注入核心。 */
import {postRender} from "./imports";
/** 用途：打开独立身份页；使用范围：仅 MAGI 身份 capability；解耦评估：通过 IdentityAccessPort 注入，面板核心不依赖具体入口。 */
import {openIdentityAccessStandalone} from "./imports";
/** 用途：创建浏览器重载动作；使用范围：仅前端重载 capability；解耦评估：工厂返回无参 Port，避免核心访问 Location。 */
import {createBrowserHostReload} from "./imports";
/** 用途：集中创建浏览器通知；使用范围：仅独立页通知 capability；解耦评估：实例化隔离在 factory，核心仅依赖 NotificationPort。 */
import {createBrowserNotification} from "./notification.browser.factory";
/** 显示独立页面的轻量消息提示，定时关闭属于用户可感知的展示时长。 */
const showToast = (message: string, timeout = 2400) => {
    const toast = document.createElement("div");
    toast.className = "agent-standalone-toast";
    toast.textContent = message;
    document.body.append(toast);
    // Toast 需要保留固定阅读时间，结束后再释放 DOM。
    window.setTimeout(() => toast.remove(), timeout);
};

/** 使用浏览器确认框承接独立页面的危险操作确认。 */
const confirmInBrowser = (title: string, message: string, onConfirm: () => void) => {
    // 用户明确确认后才执行回滚或打开未验证链接等动作。
    if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
    }
};

/** 页面处于后台且已获权限时发送浏览器通知。 */
const notifyInBrowser = (notification: {title: string; body?: string}) => {
    // 前台页面已有完整状态反馈，仅后台页面需要系统通知。
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        createBrowserNotification(notification.title, notification.body);
    }
};

/**
 * 组装浏览器实际具备的细粒度能力，缺失的布局能力保持省略。
 * @同步豁免: UI构建 必须在面板挂载前同步提供 capability 对象，异步化会改变公共挂载契约。
 */
export const createBrowserAgentPanelCapabilities = () => ({
    identityAccess: {openIdentityAccess: openIdentityAccessStandalone},
    message: {show: showToast},
    confirm: {confirm: confirmInBrowser},
    notification: {notify: notifyInBrowser},
    frontendReload: {reload: createBrowserHostReload()},
    contentRender: {postRender},
});
