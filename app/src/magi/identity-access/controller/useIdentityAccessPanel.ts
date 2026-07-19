/** 用途：Vue 生命周期与身份请求事件；使用范围：面板控制器；解耦评估：跨目录依赖由 controller 网关集中转发。 */
import * as imports from "./imports";
/** 用途：面板状态创建；使用范围：组合式控制器；解耦评估：每个宿主获得独立表单状态。 */
import { createIdentityAccessPanelState } from "./IdentityAccessPanel.state";
/** 用途：会话动作创建；使用范围：组合式控制器；解耦评估：只消费显式面板状态。 */
import { createIdentityAccessSessionActions } from "./IdentityAccessPanel.session";
/** 用途：身份管理动作创建；使用范围：组合式控制器；解耦评估：后端写操作与模板隔离。 */
import { createIdentityAccessManagementActions } from "./IdentityAccessPanel.management";

/** 保存当前面板 DOM，用于身份请求时将对应宿主滚动到可见区域。 */
function setPanelElement(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    element: HTMLElement | null,
) {
    panel.panelRef.value = element;
}

/** 把搜索输入事件安全写回当前面板查询状态。 */
function updateSearchQuery(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    event: Event,
) {
    // 只处理原生输入框事件，避免未知事件目标写入查询状态。
    if (event.target instanceof HTMLInputElement) {
        panel.searchQuery.value = event.target.value;
    }
}

/** 响应外部登录请求，刷新数据并短暂突出显示面板。 */
async function handleIdentityRequired(
    panel: ReturnType<typeof createIdentityAccessPanelState>,
    refreshPanel: () => Promise<void>,
) {
    panel.statusText.value = "Main chat requires identity login.";
    panel.panelRef.value?.scrollIntoView({ block: "start", behavior: "smooth" });
    // 同一注意态窗口内的 BroadcastChannel 回放属于同一登录请求，不重复刷新列表和统计。
    if (panel.attention.value) {
        return;
    }
    panel.attention.value = true;
    // 该延迟是用户可感知的注意态展示时长，不依赖异步任务完成时序；1800ms 后只移除视觉强调。
    panel.attentionTimer.value = setTimeout(() => {
        panel.attention.value = false;
        panel.attentionTimer.value = null;
    }, 1800);
    // 首次挂载刷新仍在执行时只保留注意态；刷新函数自身也会拒绝并发重入。
    if (!panel.loading.value) {
        await refreshPanel();
    }
}

/**
 * 作用：组合 Identity Access 状态、动作和生命周期。
 * 意图：为 Dock、Tab 和独立页提供完全相同的业务控制器。
 * 调用时机：IdentityAccessPanel 的 setup 阶段调用一次。
 */
/** @同步豁免: 生命周期 */
export const useIdentityAccessPanel = () => {
    const panel = createIdentityAccessPanelState();
    const sessionActions = createIdentityAccessSessionActions(panel);
    const managementActions = createIdentityAccessManagementActions(
        panel,
        sessionActions.loadStats,
        sessionActions.onRefresh,
    );
    const identityRequiredHandler = handleIdentityRequired.bind(null, panel, sessionActions.onRefresh);

    imports.onMounted(async () => {
        window.addEventListener(imports.MAGI_IDENTITY_REQUIRED_EVENT, identityRequiredHandler);
        await sessionActions.onRefresh();
    });

    imports.onBeforeUnmount(() => {
        window.removeEventListener(imports.MAGI_IDENTITY_REQUIRED_EVENT, identityRequiredHandler);
        // 卸载时清理仍在等待的视觉计时，避免已销毁组件被回调访问。
        if (panel.attentionTimer.value) {
            clearTimeout(panel.attentionTimer.value);
        }
    });

    return imports.proxyRefs({
        ...panel,
        ...sessionActions,
        ...managementActions,
        setPanelElement: setPanelElement.bind(null, panel),
        onSearchInput: updateSearchQuery.bind(null, panel),
    });
};
