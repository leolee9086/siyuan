/** 用途：约束会话端口组合结果；使用范围：本目录组合根；解耦评估：纯接口不加载 AgentChat class。 */
import type {AgentChatSessionPorts} from "../AgentChat.runtime.types";
/** 导出会话端口接口。 */
export type {AgentChatSessionPorts};
/** 用途：约束新建任务的空会话快照；使用范围：任务创建流程。 */
import type {AgentSession} from "../../session/AgentSession.types";
/** 导出会话快照类型。 */
export type {AgentSession};

/** 用途：创建可观察修订状态；使用范围：会话组合根。 */
import {createAgentSessionRevisionState} from "../../session/AgentSession.revisions";
/** 用途：读取可观察会话修订；使用范围：repository 端口。 */
import {getAgentSessionRevision} from "../../session/AgentSession.revisions";
/** 用途：读取会话列表；使用范围：repository 端口。 */
import {listAgentSessions} from "../../session/AgentSession.repository";
/** 用途：加载会话；使用范围：repository 端口。 */
import {loadAgentSession} from "../../session/AgentSession.repository";
/** 用途：保存会话；使用范围：repository 端口。 */
import {saveAgentSession} from "../../session/AgentSession.repository";
/** 用途：删除会话；使用范围：repository 端口。 */
import {removeAgentSession} from "../../session/AgentSession.repository";
/** 用途：重命名会话；使用范围：repository 端口。 */
import {renameAgentSession} from "../../session/AgentSession.repository";
/** 用途：切换会话权限；使用范围：repository 端口。 */
import {setAgentSessionPermission} from "../../session/AgentSession.repository";
/** 用途：校验会话标识；使用范围：repository 端口。 */
import {createAgentSessionID} from "../../session/AgentSession.id";
/** 用途：查询目录绑定资格；使用范围：taskDirectories 端口。 */
import {canBindAgentTaskDirectories} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：查询目录摘要；使用范围：taskDirectories 端口。 */
import {listAgentTaskDirectories} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：绑定主目录；使用范围：taskDirectories 端口。 */
import {bindAgentTaskDirectory} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：绑定文件浏览根内目录；使用范围：Agent 新建任务；解耦评估：服务端完成根解析和授权。 */
import {bindFileBrowserAgentTaskDirectory} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：添加目录；使用范围：taskDirectories 端口。 */
import {addAgentTaskDirectory} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：解除目录；使用范围：taskDirectories 端口。 */
import {unbindAgentTaskDirectory} from "../../task-directory/AgentTaskDirectory.repository";
/** 用途：读取提示词来源；使用范围：promptSources 端口。 */
import {getAgentPromptSource} from "../../prompt/AgentPromptSource.repository";
/** 用途：搜索提示词来源；使用范围：promptSources 端口。 */
import {searchAgentPromptSourceDocuments} from "../../prompt/AgentPromptSource.repository";
/** 用途：解析提示词来源；使用范围：promptSources 端口。 */
import {resolveAgentPromptSourceDocument} from "../../prompt/AgentPromptSource.repository";
/** 用途：绑定提示词来源；使用范围：promptSources 端口。 */
import {bindAgentPromptSourceDocument} from "../../prompt/AgentPromptSource.repository";
/** 用途：刷新提示词来源；使用范围：promptSources 端口。 */
import {refreshAgentPromptSourceDocument} from "../../prompt/AgentPromptSource.repository";
/** 用途：保持提示词快照；使用范围：promptSources 端口。 */
import {keepAgentPromptSourceDocument} from "../../prompt/AgentPromptSource.repository";
/** 用途：创建提示词文档；使用范围：promptSources 端口。 */
import {createAgentPromptSourceDocument} from "../../prompt/AgentPromptSource.repository";
/** 用途：上传聊天附件；使用范围：uploadFiles 端口。 */
import {uploadAgentFiles} from "../../attachments/AgentFileUpload";
/** 用途：生成显式 owner 请求头；使用范围：全部 Agent 请求。 */
import {createAgentRequestHeaders} from "../../request/AgentRequest.headers";
/** 用途：约束请求头输入；使用范围：组合根请求头函数。 */
import type {AgentRequestHeaderInput} from "../../request/AgentRequest.types";

/** 导出可观察修订状态工厂。 */
export {createAgentSessionRevisionState};
/** 导出会话修订读取器。 */
export {getAgentSessionRevision};
/** 导出会话列表实现。 */
export {listAgentSessions};
/** 导出会话加载实现。 */
export {loadAgentSession};
/** 导出会话保存实现。 */
export {saveAgentSession};
/** 导出会话删除实现。 */
export {removeAgentSession};
/** 导出会话重命名实现。 */
export {renameAgentSession};
/** 导出会话权限实现。 */
export {setAgentSessionPermission};
/** 导出会话标识生成命令。 */
export {createAgentSessionID};
/** 导出目录资格实现。 */
export {canBindAgentTaskDirectories};
/** 导出目录查询实现。 */
export {listAgentTaskDirectories};
/** 导出主目录绑定实现。 */
export {bindAgentTaskDirectory};
/** 导出文件浏览目录绑定实现。 */
export {bindFileBrowserAgentTaskDirectory};
/** 导出附加目录实现。 */
export {addAgentTaskDirectory};
/** 导出目录解除实现。 */
export {unbindAgentTaskDirectory};
/** 导出提示词来源读取实现。 */
export {getAgentPromptSource};
/** 导出提示词来源搜索实现。 */
export {searchAgentPromptSourceDocuments};
/** 导出提示词来源解析实现。 */
export {resolveAgentPromptSourceDocument};
/** 导出提示词来源绑定实现。 */
export {bindAgentPromptSourceDocument};
/** 导出提示词来源刷新实现。 */
export {refreshAgentPromptSourceDocument};
/** 导出提示词快照保持实现。 */
export {keepAgentPromptSourceDocument};
/** 导出提示词文档创建实现。 */
export {createAgentPromptSourceDocument};
/** 导出附件上传实现。 */
export {uploadAgentFiles};
/** 导出请求头生成实现。 */
export {createAgentRequestHeaders};
/** 导出请求头输入类型。 */
export type {AgentRequestHeaderInput};

/** 用途：装配会话消息构建与渲染；使用范围：projection 端口；解耦评估：具体消息模块只在会话组合根出现。 */
import {buildEntriesFromSession, renderLoadedSession} from "../message/projection/AgentChat.sessionRender.methods";
/** 导出会话条目构建实现。 */
export {buildEntriesFromSession};
/** 导出会话渲染实现。 */
export {renderLoadedSession};
/** 用途：装配网页引用清理；使用范围：projection 端口；解耦评估：具体消息状态函数只在组合根出现。 */
import {resetWebReferenceIndex} from "../message/projection/AgentChat.persisted.methods";
/** 导出网页引用清理实现。 */
export {resetWebReferenceIndex};

/** 用途：装配会话模型读取与应用；使用范围：presentation 端口；解耦评估：模型具体函数不进入会话业务文件。 */
import {applySessionModelIfValid, getSelectedModel} from "../ui/model/AgentChat.model.methods";
/** 导出会话模型应用实现。 */
export {applySessionModelIfValid};
/** 导出当前模型读取实现。 */
export {getSelectedModel};
/** 用途：装配令牌展示刷新；使用范围：presentation 端口；解耦评估：指标 DOM 函数只在组合根出现。 */
import {updateTokenDisplay} from "../interaction/metrics/AgentChat.metrics.methods";
/** 导出令牌展示实现。 */
export {updateTokenDisplay};
/** 用途：装配错误卡片呈现；使用范围：presentation 端口；解耦评估：响应流程只依赖抽象呈现命令。 */
import {appendError} from "../interaction/errors/AgentChat.errorCards";
/** 导出错误卡片呈现实现。 */
export {appendError};
/** 用途：装配滚动与观察能力；使用范围：presentation 端口；解耦评估：滚动具体实现不进入会话状态机。 */
import {observeStickTarget, restoreScrollToBottom, scrollToBottom} from "../ui/feedback/AgentChat.scrolling";
/** 导出贴底观察实现。 */
export {observeStickTarget};
/** 导出距底恢复实现。 */
export {restoreScrollToBottom};
/** 导出贴底滚动实现。 */
export {scrollToBottom};
/** 用途：装配导航标记重建；使用范围：presentation 端口；解耦评估：导航 DOM 实现只在组合根出现。 */
import {rebuildNavMarkers} from "../ui/navigation/AgentChat.navigation";
/** 导出导航重建实现。 */
export {rebuildNavMarkers};
/** 用途：装配空会话欢迎页；使用范围：presentation 端口；解耦评估：欢迎页实现不进入会话状态机。 */
import {showWelcome} from "../ui/welcome/AgentChat.welcome.methods";
/** 导出欢迎页实现。 */
export {showWelcome};
/** 用途：装配会话能力可见性同步；使用范围：presentation 端口；解耦评估：宿主 UI 实现只在组合根出现。 */
import {applyConversationCapabilityVisibility} from "../ui/lifecycle/AgentChat.shell.methods";
/** 导出会话能力同步实现。 */
export {applyConversationCapabilityVisibility};
/** 用途：装配发送按钮刷新；使用范围：presentation 端口；解耦评估：交互 DOM 实现只在组合根出现。 */
import {updateSendButtonState} from "../ui/feedback/AgentChat.streamingState";
/** 导出发送按钮刷新实现。 */
export {updateSendButtonState};
/** 用途：装配镜像占位呈现；使用范围：presentation 端口；解耦评估：会话状态机只依赖镜像视图接口。 */
import {removeMirrorPlaceholder, showMirrorPlaceholder} from "./view/AgentChat.mirror";
/** 导出镜像占位移除实现。 */
export {removeMirrorPlaceholder};
/** 导出镜像占位显示实现。 */
export {showMirrorPlaceholder};

/** 用途：装配流式状态切换；使用范围：turnLifecycle 端口；解耦评估：具体交互锁函数只在组合根出现。 */
import {setStreaming} from "../ui/feedback/AgentChat.streamingState";
/** 导出流式状态实现。 */
export {setStreaming};
/** 用途：装配活动思考收尾；使用范围：turnLifecycle 端口；解耦评估：具体思考视图函数只在组合根出现。 */
import {finishActiveThinking} from "../ui/feedback/AgentChat.thinkingState";
/** 导出活动思考收尾实现。 */
export {finishActiveThinking};
/** 用途：装配思考步骤提交；使用范围：turnLifecycle 端口；解耦评估：具体流模块只在组合根出现。 */
import {flushThinkingStep} from "../stream/thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交实现。 */
export {flushThinkingStep};
/** 用途：装配用户编辑草稿恢复；使用范围：turnLifecycle 端口；解耦评估：用户消息 DOM 实现只在组合根出现。 */
import {restorePendingEditDraft} from "../message/user/AgentChat.userActions";
/** 导出用户草稿恢复实现。 */
export {restorePendingEditDraft};

/** 用途：装配 MAGI 身份快照读取；使用范围：magiConversation 端口；解耦评估：身份服务只在会话组合根出现。 */
import {getActiveMagiArmorSession} from "../../../../../magi/service/magiIdentitySession";
/** 导出 MAGI 身份读取实现。 */
export {getActiveMagiArmorSession};
/** 用途：装配 MAGI 历史加载；使用范围：magiConversation 端口；解耦评估：具体会话服务只在组合根出现。 */
import {loadMagiMainUIConversation} from "../../../../../magi/conversation/magiMainUIConversation";
/** 导出 MAGI 历史加载实现。 */
export {loadMagiMainUIConversation};
