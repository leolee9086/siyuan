/**
 * 用途：生成上传附件的 Markdown 文本。
 * 使用范围：仅供会话文件上传流程写入编辑器。
 * 解耦评估：格式化函数是附件协议的唯一实现，目录网关只转发其纯函数接口。
 */
import {formatAgentUploadedFileMarkdown} from "../../../attachments/AgentUploadedFile.markdown";
/** 导出附件 Markdown 格式化函数。 */
export {formatAgentUploadedFileMarkdown};

/** 用途：约束当前目录绑定；使用范围：文件菜单输入。 */
import type {TaskDirectoryBinding} from "../../../task-directory/AgentTaskDirectory.types";
/** 导出目录绑定类型。 */
export type {TaskDirectoryBinding};
/** 用途：约束目录菜单动作；使用范围：目录操作命令。 */
import type {TaskDirectoryMenuAction} from "../../../task-directory/AgentTaskDirectory.types";
/** 导出目录菜单动作类型。 */
export type {TaskDirectoryMenuAction};
/** 用途：约束完整上传结果；使用范围：上传结果校验。 */
import type {AgentFileUploadResult} from "../../../attachments/AgentFileUpload.types";
/** 导出完整上传结果。 */
export type {AgentFileUploadResult};
/** 用途：约束上传成功文件；使用范围：编辑器链接插入。 */
import type {AgentUploadedFile} from "../../../attachments/AgentFileUpload.types";
/** 导出上传成功文件。 */
export type {AgentUploadedFile};

/**
 * 用途：执行会话目录绑定、重选和解除动作。
 * 使用范围：仅供文件菜单动作回调使用。
 * 解耦评估：控制器已经通过回调接收保存和刷新端口，本模块不复制其权限判断。
 */
import {runAgentTaskDirectoryAction} from "../../../session-panel/controller";
/** 导出目录动作控制器。 */
export {runAgentTaskDirectoryAction};

/**
 * 用途：依据 Kernel 能力生成目录菜单动作。
 * 使用范围：仅供当前会话文件菜单构建。
 * 解耦评估：菜单动作生成器是共享纯函数，复用它可保证远端客户端的权限门控一致。
 */
import {buildTaskDirectoryMenuActions} from "../../../session-panel/menu.actions";
/** 导出目录菜单动作生成器。 */
export {buildTaskDirectoryMenuActions};

/** 用途：约束会话目标类型；使用范围：异步操作身份核对。 */
import type {AgentPanelConversationKind} from "../../../runtime/agentPanel.ports.types";
/** 导出会话目标类型。 */
export type {AgentPanelConversationKind};
/** 用途：约束菜单项协议；使用范围：文件菜单返回边界。 */
import type {PanelMenuItem} from "../../../runtime/agentPanel.ports.types";
/** 导出菜单项协议。 */
export type {PanelMenuItem};

/** 用途：约束文件流程读写的公开聊天状态；使用范围：本目录全部职责函数。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};
/** 用途：约束新建任务快照；使用范围：任务创建流程。 */
import type {AgentSession} from "../../../session/AgentSession.types";
/** 导出会话快照类型。 */
export type {AgentSession};

/** 用途：判断编辑器是否有内容；使用范围：上传链接插入前的换行处理。 */
import {hasComposerInput} from "../../ui/feedback/AgentChat.streamingState";
/** 导出编辑器内容判断函数。 */
export {hasComposerInput};
/** 用途：刷新发送按钮；使用范围：上传链接插入完成后。 */
import {updateSendButtonState} from "../../ui/feedback/AgentChat.streamingState";
/** 导出发送按钮刷新函数。 */
export {updateSendButtonState};
/** 用途：同步文件入口状态；使用范围：文件操作开始与结束。 */
import {updateSessionFileActionState} from "../../ui/feedback/AgentChat.streamingState";
/** 导出文件入口状态刷新函数。 */
export {updateSessionFileActionState};

/**
 * 用途：在首次目录绑定前持久化当前会话。
 * 使用范围：仅供本目录文件流程调用。
 * 解耦评估：保存函数已隔离存储快照与冲突处理，本目录只触发其公开职责函数。
 */
import {saveSession} from "../persistence/AgentChat.save";
/** 导出会话保存函数。 */
export {saveSession};
