/**
 * 用途：约束 AgentChat 所属应用和布局页签。
 * 使用范围：核心运行时公开状态。
 * 解耦评估：两个类型都是领域抽象，核心模块不加载 App、Model 或 Tab 的具体 class。
 */
import type {AppFacade} from "../../../../app/AppFacade.types";
/** 导出应用公共领域表面。 */
export type {AppFacade};
/**
 * 用途：约束 AgentChat 挂载页签的公开 DOM 与生命周期。
 * 使用范围：核心运行时 parent 字段。
 * 解耦评估：LayoutTab 是布局聚合根接口，可由真实 Tab 和测试替身共同实现。
 */
import type {LayoutTab} from "../../../layout.types";
/** 导出布局页签领域类型。 */
export type {LayoutTab};

/**
 * 用途：约束 Agent 输入编辑器的完整公共能力。
 * 使用范围：核心运行时 composer 字段。
 * 解耦评估：ComposerHandle 抽象 Protyle 与 Tiptap，不导入任一具体挂载函数。
 */
import type {ComposerHandle} from "../composer/AgentComposer.types";
/** 导出输入编辑器领域接口。 */
export type {ComposerHandle};

/**
 * 用途：约束提示词来源的公开生命周期和操作状态。
 * 使用范围：核心运行时 promptSourceController 字段。
 * 解耦评估：领域接口隐藏具体控制器实现，便于测试注入可观察替身。
 */
import type {AgentPromptSourceDomain} from "../prompt/AgentPromptSource.types";
/** 导出提示词来源领域接口。 */
export type {AgentPromptSourceDomain};

/**
 * 用途：约束会话面板公开生命周期。
 * 使用范围：核心运行时 sessionPanel 字段。
 * 解耦评估：控制器接口不加载会话面板工厂或 DOM 实现。
 */
import type {AgentSessionPanelController} from "../session-panel/types";
/** 导出会话面板领域接口。 */
export type {AgentSessionPanelController};

/**
 * 用途：约束宿主能力和会话目标种类。
 * 使用范围：核心运行时 capability 与 conversationKind 字段。
 * 解耦评估：细粒度 Port 由宿主组合根注入，核心模块不依赖桌面实现。
 */
import type {AgentPanelCapabilities, AgentPanelConversationKind} from "../runtime/agentPanel.ports.types";
/** 导出 Agent 面板能力集合。 */
export type {AgentPanelCapabilities};
/** 导出 Agent 面板会话目标类型。 */
export type {AgentPanelConversationKind};

/**
 * 用途：约束会话仓储端口的输入和返回数据。
 * 使用范围：核心运行时声明的 sessionPorts。
 * 解耦评估：只引入会话领域的数据契约，不加载仓储实现。
 */
import type {AgentSession} from "../session/AgentSession.types";
/** 用途：复用完整会话仓储抽象；使用范围：AgentChat 会话端口。 */
import type {AgentChatSessionRepository} from "../session/AgentSession.types";
/** 用途：约束任务目录仓储；使用范围：AgentChat 会话端口。 */
import type {AgentTaskDirectoryRepository} from "../task-directory/AgentTaskDirectory.types";
/** 用途：约束提示词来源仓储；使用范围：AgentChat 会话端口。 */
import type {AgentPromptSourceRepository} from "../prompt/AgentPromptSource.types";
/** 用途：约束附件上传结果；使用范围：AgentChat 会话端口。 */
import type {AgentFileUploadResult} from "../attachments/AgentFileUpload.types";
/** 用途：约束动态请求头能力；使用范围：AgentChat 会话端口。 */
import type {AgentRequestHeaders} from "../request/AgentRequest.types";
/** 导出持久化会话类型。 */
export type {AgentSession};
/** 导出完整会话仓储抽象。 */
export type {AgentChatSessionRepository};
/** 导出任务目录仓储抽象。 */
export type {AgentTaskDirectoryRepository};
/** 导出提示词来源仓储抽象。 */
export type {AgentPromptSourceRepository};
/** 导出附件上传结果。 */
export type {AgentFileUploadResult};
/** 导出请求头能力。 */
export type {AgentRequestHeaders};
