/** 用途：加载独立 Agent 运行时前置资源；使用范围：MAGI Agent Panel 宿主；解耦评估：经同目录网关复用共享引导。 */
import {bootstrapAgentPanelRuntime} from "./imports";
/** 用途：提供浏览器宿主能力；使用范围：MAGI 独立桌面与移动页面；解耦评估：经同目录网关获取细粒度 ports 组合。 */
import {createBrowserAgentPanelCapabilities} from "./imports";
/** 用途：挂载统一 Agent Panel；使用范围：MAGI CHAT 容器；解耦评估：经同目录网关依赖稳定挂载契约。 */
import {mountAgentPanel} from "./imports";
/** 用途：接收身份页头像草稿事件；使用范围：MAGI 身份页到当前聊天 Composer；解耦评估：事件契约避免组件引用耦合。 */
import {MAGI_WRITE_AVATAR_EVENT} from "./imports";
/** 用途：复用宿主运行时句柄类型；使用范围：工厂返回值和 Vue 宿主变量；解耦评估：类型边界独立于实现文件。 */
import type {MagiAgentPanelHostRuntime} from "./AgentPanelHostRuntime.types";
/** 用途：约束宿主内部可变状态；使用范围：模块级生命周期函数；解耦评估：状态类型与行为实现分离。 */
import type {MagiAgentPanelHostRuntimeState} from "./AgentPanelHostRuntime.types";

/**
 * 作用：将身份头像流程产生的提示词写入当前面板草稿。
 * 意图：头像流程和 Agent Composer 通过事件契约通信，不互相访问组件引用。
 * 调用时机：窗口收到 `MAGI_WRITE_AVATAR_EVENT` 时。
 */
function handleWriteAvatarEvent(state: MagiAgentPanelHostRuntimeState, event: Event) {
    const prompt = event instanceof CustomEvent ? event.detail : null;
    if (typeof prompt !== "string" || !prompt.trim()) {
        return;
    }
    state.pendingDraft = prompt.trim();
    void state.panel?.setDraft(state.pendingDraft);
}

/**
 * 作用：幂等释放窗口事件和已经挂载的面板。
 * 意图：组件卸载与初始化失败共用释放路径，并让晚到面板由初始化流程自行销毁。
 * 调用时机：宿主卸载或异步初始化失败时。
 */
function destroyMagiAgentPanelHostRuntime(state: MagiAgentPanelHostRuntimeState) {
    if (state.disposed) {
        return;
    }
    state.disposed = true;
    if (state.writeAvatarListener) {
        window.removeEventListener(MAGI_WRITE_AVATAR_EVENT, state.writeAvatarListener);
    }
    state.panel?.destroy();
    state.panel = null;
}

/**
 * 作用：加载共享运行时并挂载默认指向 MAGI 的 Agent Panel。
 * 意图：集中处理初始化错误、卸载竞态和引导期间积压的头像草稿。
 * 调用时机：宿主运行时状态创建并注册窗口事件后执行一次。
 */
async function initializeMagiAgentPanelHostRuntime(state: MagiAgentPanelHostRuntimeState) {
    try {
        await bootstrapAgentPanelRuntime();
        const mountedPanel = await mountAgentPanel({
            target: state.target,
            initialConversation: {kind: "magi"},
            capabilities: createBrowserAgentPanelCapabilities(),
            enableSessionWebSocket: false,
        });
        if (state.disposed) {
            mountedPanel.destroy();
            return;
        }
        state.panel = mountedPanel;
        if (state.pendingDraft) {
            await state.panel.setDraft(state.pendingDraft);
        }
    } catch (error) {
        destroyMagiAgentPanelHostRuntime(state);
        throw error;
    }
}

/**
 * 作用：挂载 MAGI 的统一 Agent Panel，并管理初始化期间的完整生命周期。
 * 意图：让 Vue 组件只提供 DOM 容器，避免各宿主重复实现异步卸载竞态和头像草稿转发。
 * 调用时机：`AgentPanelHost` 完成 DOM 挂载后调用一次。
 */
/** @同步豁免: 生命周期 */
export function createMagiAgentPanelHostRuntime(target: HTMLElement) {
    const state: MagiAgentPanelHostRuntimeState = {
        target,
        panel: null,
        disposed: false,
        pendingDraft: "",
    };
    state.writeAvatarListener = handleWriteAvatarEvent.bind(undefined, state);
    window.addEventListener(MAGI_WRITE_AVATAR_EVENT, state.writeAvatarListener);
    const runtime: MagiAgentPanelHostRuntime = {
        ready: initializeMagiAgentPanelHostRuntime(state),
        destroy: destroyMagiAgentPanelHostRuntime.bind(undefined, state),
    };
    return runtime;
}
