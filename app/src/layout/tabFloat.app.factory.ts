/** 用途：创建完整 App 的 Dialog 浮层。使用范围：Tab 浮窗宿主适配器；解耦评估：仅此 App 边界依赖具体 Dialog，核心通过 Port 隔离。 */
import {Dialog} from "../dialog";
/** 用途：承载副本面板 DOM 的临时页签。使用范围：浮窗生命周期；解耦评估：Tab 是稳定句柄，宿主不移动原始页签。 */
import type {ILayoutTabHandle} from "./tabFloat.types";
/** 用途：向布局能力注册表写入完整 App 实现。使用范围：入口初始化；解耦评估：菜单只依赖 Port，不直接依赖该注册模块。 */
import {setLayoutTabFloatPort} from "./tabFloat.port";
/** 用途：查找模型声明的浮窗副本能力；使用范围：完整 App Dialog 适配器。 */
import {getTabFloatFactory} from "./tabFloat.registry";
import type {ILayoutTabFloatCopy} from "./tabFloat.types";

// 静态加载内建能力，避免运行时动态 import 导致构建产物和初始化时序不稳定。
import "../editor/tabFloat.factory";
import "./dock/agent/runtime/host/floating/tabFloat.factory";

/**
 * 完整 App 的 Tab 浮窗适配器。
 *
 * 这里是布局能力和具体 Dialog/Agent Dock 的唯一连接点：布局菜单只请求能力，
 * 独立宿主可以注册自己的实现；完整 App 则为已支持的 Dock 创建独立副本。
 */
/**
 * 作用：构造完整 App 的浮窗能力对象。
 * 意图：每次入口初始化都获得独立 Port 状态，避免模块级对象在 HMR/测试间残留。
 * 调用时机：完整 App 模块加载时注册一次；未来宿主可复用同一工厂替换实现。
 */
const createAppTabFloatPort = () => ({
    /**
     * 作用：为支持副本工厂的 Dock 打开独立 Dialog。
     * 意图：保持原始 Tab 在布局树中的位置，同时提供可交互的独立实例。
     * 调用时机：完整 App 注册此 Port 后，用户从 Tab 菜单选择“作为浮窗打开”时调用。
     */
    async open(tab: ILayoutTabHandle) {
        const factory = getTabFloatFactory(tab);
        if (!factory) {
            return false;
        }

        let temporaryTab: ILayoutTabHandle;
        try {
            temporaryTab = factory.createTab(tab);
        } catch (error) {
            console.error(`[layout-tab-float] failed to prepare ${factory.id} copy`, error);
            return false;
        }
        let copy: ILayoutTabFloatCopy | undefined;
        let disposed = false;
        let closed = false;

        const dialog = new Dialog({
            title: tab.title || window.siyuan.languages.agentChat || "Agent",
            content: '<div class="layout-tab-float-copy fn__flex fn__flex-column" style="height:100%;"></div>',
            width: "720px",
            height: "760px",
            containerClassName: "layout-tab-float-dialog",
            // Tab 副本是页面内的非模态浮窗：不遮罩、不占用全局 Dialog 栈，但保留统一关闭和生命周期。
            rootClassName: "b3-dialog--popover",
            showScrim: false,
            registerInDialogStack: false,
            /** 作用：Dialog 关闭后销毁副本资源；意图：避免副本 WebSocket/编辑器残留；调用时机：关闭按钮、遮罩或 ESC 触发 Dialog 销毁时。 */
            destroyCallback: () => {
                closed = true;
                if (!disposed && copy) {
                    disposed = true;
                    copy.dispose();
                }
                temporaryTab.panelElement.remove();
                temporaryTab.headElement?.remove();
            },
        });

        const host = dialog.element.querySelector(".layout-tab-float-copy");
        // Dialog 内容由统一模板生成；缺少宿主节点时无法安全挂载副本，应立即销毁空 Dialog。
        if (!(host instanceof HTMLElement)) {
            dialog.destroy();
            return true;
        }

        host.appendChild(temporaryTab.panelElement);
        try {
            copy = await factory.create(tab, temporaryTab);
            if (closed) {
                disposed = true;
                copy.dispose();
                return true;
            }
            copy.setCloseHandler?.(() => dialog.destroy());
            return true;
        } catch (error) {
            console.error(`[layout-tab-float] failed to create ${factory.id} copy`, error);
            dialog.destroy();
            return true;
        }
    },
});

setLayoutTabFloatPort(createAppTabFloatPort());
