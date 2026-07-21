import {postRender} from "../layout/dock/agent/AgentMessageRenderer";
import {openIdentityAccessStandalone} from "../magi/identity-access/adapters/open";
/** 显示独立页面的轻量消息提示，定时关闭属于用户可感知的展示时长。 */
const showToast = (message: string, timeout = 2400) => {
    const toast = document.createElement("div");
    toast.className = "agent-standalone-toast";
    toast.textContent = message;
    document.body.append(toast);
    // Toast 需要保留固定阅读时间，结束后再释放 DOM。
    window.setTimeout(() => toast.remove(), timeout);
};

/** 打开 MAGI 独立身份入口，供缺少完整 App 布局的宿主使用。 */
const openBrowserIdentityAccess = () => openIdentityAccessStandalone();

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
        new Notification(notification.title, {body: notification.body});
    }
};

/** 将焦点交给可挂载面板根节点。 */
const focusBrowserPanel = (panel: HTMLElement) => panel.focus();

/** 执行与完整 App 无关的富内容后处理。 */
const postRenderBrowserContent = (container: HTMLElement) => postRender(container);

/** 组装浏览器实际具备的细粒度能力，缺失的布局能力保持省略。 */
export const createBrowserAgentPanelCapabilities = () => ({
    identityAccess: {openIdentityAccess: openBrowserIdentityAccess},
    message: {show: showToast},
    confirm: {confirm: confirmInBrowser},
    notification: {notify: notifyInBrowser},
    focus: {focus: focusBrowserPanel},
    contentRender: {postRender: postRenderBrowserContent},
});
