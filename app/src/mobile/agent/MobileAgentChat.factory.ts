/** 用途：约束移动 Agent 工厂的应用上下文；使用范围：聊天模型创建；解耦评估：通过 imports.ts 集中依赖，避免业务文件跨层加载。 */
import type {AppFacade} from "./imports";
/** 用途：取得 AgentChat 构造契约；使用范围：集中实例化移动聊天模型；解耦评估：复用现有模型实现，避免移动端派生副本。 */
import {AgentChat} from "./imports";
/** 用途：取得 Tab 容器构造契约；使用范围：移动 Agent 面板创建；解耦评估：布局生命周期必须由统一 Tab 模型维护。 */
import {Tab} from "./imports";

/** 创建移动 Agent 所需的 Tab 容器；仅在首次打开面板时调用。 */
/** @同步豁免: UI构建 */
export const createMobileAgentTab = () => new Tab({});

/** 创建移动 Agent 聊天模型；集中实例化以保持面板装配边界。 */
/** @同步豁免: UI构建 */
export const createMobileAgentChat = (
    currentApp: AppFacade,
    tab: Tab,
    options: ConstructorParameters<typeof AgentChat>[2],
) => new AgentChat(currentApp, tab, options);
