/** 用途：加载独立页面布局样式；使用范围：仅 agent-app 根页面；解耦评估：页面专属布局不进入共享控制器。 */
import "./style.scss";
/** 用途：准备配置、语言、主题、图标和 Lute；使用范围：独立 Agent 挂载前；解耦评估：共享 bootstrap 隔离环境初始化。 */
import {bootstrapAgentPanelRuntime} from "./bootstrap";
/** 用途：声明公共会话类型；使用范围：独立 ESM 类型导出；解耦评估：经目录网关 type-only 转发，不提前加载核心。 */
import type {AgentPanelConversation} from "./imports";
/** 用途：声明公共句柄类型；使用范围：独立 ESM 类型导出；解耦评估：经目录网关 type-only 转发，不提前加载核心。 */
import type {AgentPanelHandle} from "./imports";
/** 用途：约束挂载函数参数；使用范围：独立 ESM 公共函数；解耦评估：经目录网关 type-only 转发，不提前加载核心。 */
import type {AgentPanelMountOptions} from "./imports";

/** 导出独立挂载所需的公共会话、句柄和选项类型。 */
export type {AgentPanelConversation, AgentPanelHandle, AgentPanelMountOptions};

/** 准备浏览器运行时并挂载唯一 Agent Panel 实现。 */
export const mountStandaloneAgentPanel = async (options: AgentPanelMountOptions) => {
    await bootstrapAgentPanelRuntime();
    const {mountAgentPanel, createBrowserAgentPanelCapabilities} = await import("./panel-runtime");
    return mountAgentPanel({
        ...options,
        capabilities: options.capabilities ?? createBrowserAgentPanelCapabilities(),
        enableSessionWebSocket: options.enableSessionWebSocket ?? false,
    });
};

/** 在独立入口启动异常时渲染可诊断错误，同时避免把原始文本拼入 HTML。 */
const renderStandaloneAgentError = (root: HTMLElement, error: unknown) => {
    console.error("[agent-standalone] bootstrap failed", error);
    root.innerHTML = '<div class="agent-standalone-error"><strong>Agent workspace failed to start</strong><span></span></div>';
    const detail = root.querySelector("span");
    if (detail) {
        detail.textContent = error instanceof Error ? error.message : String(error);
    }
};

/** 从独立页面 DOM 和 URL 创建默认面板实例，所有可变引用只存在于本次启动调用内。 */
async function mountAgentPanelFromDocument() {
    const root = document.getElementById("agent-panel");
    if (!root) {
        return;
    }
    const params = new URLSearchParams(location.search);
    const kind = params.get("kind") === "magi" ? "magi" : "native-agent";
    const sessionId = params.get("sessionId") || undefined;
    try {
        const panel = await mountStandaloneAgentPanel({
            target: root,
            initialConversation: {kind, ...(sessionId ? {sessionId} : {})},
        });
        Reflect.set(window, "standaloneAgentPanel", panel);
    } catch (error) {
        renderStandaloneAgentError(root, error);
    }
}

void mountAgentPanelFromDocument();
