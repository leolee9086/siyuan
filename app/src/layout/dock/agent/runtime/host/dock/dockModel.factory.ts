/** 用途：创建 Agent 布局模型；使用范围：仅 Agent Dock 工厂；解耦评估：模型类是工厂产物，具体宿主能力仍由参数注入。 */
import {AgentChat} from "./imports";
/** 用途：组合主应用能力；使用范围：仅完整 App 的 Dock/Tab/浮窗；解耦评估：独立页和 MAGI 使用各自能力工厂，不依赖此适配器。 */
import {createAppAgentPanelCapabilities} from "./imports";
/**
 * 作用：为常驻 Agent Dock 创建带完整应用能力的模型。
 * 意图：让 Dock 注册表只依赖细粒度 Agent 工厂，避免加载或复制能力组合逻辑。
 * 调用时机：主布局反序列化或首次创建 `agentChat` Dock 时。
 * 布局 `ModelFactory` 必须在反序列化调用栈内立即返回模型，异步返回会破坏 `Tab.addModel` 契约。
 */
/** @同步豁免: UI构建 */
export const createAgentDockModel = (
    app: Parameters<typeof createAppAgentPanelCapabilities>[0],
    tab: Parameters<typeof createAppAgentPanelCapabilities>[1],
) => {
    return new AgentChat(app, tab, {
        capabilities: createAppAgentPanelCapabilities(app, tab),
        capabilitiesFactory: createAppAgentPanelCapabilities.bind(undefined, app),
    });
};
