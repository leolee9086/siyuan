/** 用途：处理独立页消息富内容；使用范围：浏览器宿主能力；解耦评估：具体渲染器只在组合根进入能力聚合。 */
import {postRender} from "./imports";
/** 用途：打开独立身份页；使用范围：浏览器宿主能力；解耦评估：面板核心不依赖具体入口。 */
import {openIdentityAccessStandalone} from "./imports";
/** 用途：创建浏览器重载动作；使用范围：浏览器宿主能力；解耦评估：避免核心访问 Location。 */
import {createBrowserHostReload} from "./imports";
/** 用途：创建独立页标准对话框；使用范围：浏览器宿主能力；解耦评估：具体类不进入 Agent 面板领域。 */
import {Dialog} from "./imports";
/** 用途：集中创建浏览器通知；使用范围：浏览器宿主能力；解耦评估：实例化隔离在宿主边界。 */
import {createBrowserNotification} from "./notification.browser.factory";
/** 用途：承载独立页菜单状态；使用范围：浏览器能力组合根；解耦评估：菜单实例与完整能力对象保持相同生命周期。 */
import {Menu} from "./imports";
/** 用途：渲染独立页菜单动作；使用范围：浏览器能力组合根；解耦评估：复用公共菜单项。 */
import {MenuItem} from "./imports";
/** 用途：约束完整浏览器宿主能力；使用范围：能力组合根返回值；解耦评估：复用 Agent 面板唯一能力聚合。 */
import type {AgentPanelCapabilities} from "./imports";
/** 用途：约束菜单动作；使用范围：独立页菜单渲染；解耦评估：纯数据类型。 */
import type {PanelMenuItem} from "./imports";
/** 显示独立页面的轻量消息提示，定时关闭属于用户可感知的展示时长。 */
const showToast = (message: string, timeout = 2400) => {
    const toast = document.createElement("div");
    toast.className = "agent-standalone-toast";
    toast.textContent = message;
    document.body.append(toast);
    toast.style.setProperty("--agent-standalone-toast-duration", `${timeout}ms`);
    toast.addEventListener("animationend", () => toast.remove(), {once: true});
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
 * @显式返回类型原因: 独立宿主必须在编译期校验与共享 AgentPanelCapabilities 公共契约一致。
 * @同步豁免: UI构建 必须在面板挂载前同步提供 capability 对象，异步化会改变公共挂载契约。
 */
export const createBrowserAgentPanelCapabilities = (): AgentPanelCapabilities => {
    const menu = new Menu({closeOnOutsideClick: true});

    /** 在指定锚点展示当前 Agent 面板动作，并替换同一宿主此前打开的菜单内容。 */
    // @柯里化：菜单展示动作需要捕获本次宿主能力工厂创建的独立 Menu 实例。
    const showMenu = (name: string, anchor: HTMLElement, items: PanelMenuItem[]) => {
        menu.remove();
        menu.element.setAttribute("data-name", name);
        for (const item of items) {
            menu.append(new MenuItem({
                label: item.label,
                click: item.click,
                ...(item.icon ? {icon: item.icon} : {}),
                ...(item.current === undefined ? {} : {current: item.current}),
                ...(item.warning === undefined ? {} : {warning: item.warning}),
                ...(item.disabled === undefined ? {} : {disabled: item.disabled}),
            }).element);
        }
        const rect = anchor.getBoundingClientRect();
        menu.popup({x: rect.right, y: rect.bottom, isLeft: true});
    };

    /** 关闭当前菜单；提供名称时只关闭同一 Agent 功能拥有的菜单实例。 */
    // @柯里化：菜单关闭动作需要与 showMenu 共享本次宿主能力工厂创建的 Menu 实例。
    const closeMenu = (name?: string) => {
        // 无名称表示宿主统一关闭；名称匹配时表示所属功能仍拥有当前菜单。
        if (!name || menu.element.getAttribute("data-name") === name) {
            menu.remove();
        }
    };

    return {
        /** 在独立页面导航到身份访问入口，等待导航动作完成后再结束宿主命令。 */
        async openIdentityAccess() {
            await openIdentityAccessStandalone();
        },
        showMessage: showToast,
        confirm: confirmInBrowser,
        /** 将标准 Dialog 构造限制在独立浏览器宿主边界。 */
        createDialog(options) {
            return new Dialog(options);
        },
        showMenu,
        closeMenu,
        notify: notifyInBrowser,
        reloadFrontend: createBrowserHostReload(),
        postRender,
    };
};
