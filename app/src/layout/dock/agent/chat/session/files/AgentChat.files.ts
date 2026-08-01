/** 用途：生成附件 Markdown；使用范围：上传结果写入编辑器。 */
import {formatAgentUploadedFileMarkdown} from "./imports";
/** 用途：约束完整上传结果；使用范围：上传结果校验。 */
import type {AgentFileUploadResult} from "./imports";
/** 用途：约束上传成功文件；使用范围：编辑器链接插入。 */
import type {AgentUploadedFile} from "./imports";
/** 用途：约束会话目标；使用范围：异步操作身份。 */
import type {AgentPanelConversationKind} from "./imports";
/** 用途：约束运行时状态；使用范围：本文件全部职责函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束菜单项；使用范围：菜单构建返回值。 */
import type {PanelMenuItem} from "./imports";
/** 用途：约束目录绑定；使用范围：文件菜单输入。 */
import type {TaskDirectoryBinding} from "./imports";
/** 用途：约束目录动作；使用范围：目录操作命令。 */
import type {TaskDirectoryMenuAction} from "./imports";
/** 用途：生成目录动作；使用范围：文件菜单构建。 */
import {buildTaskDirectoryMenuActions} from "./imports";
/** 用途：判断编辑器内容；使用范围：附件链接换行。 */
import {hasComposerInput} from "./imports";
/** 用途：执行目录动作；使用范围：菜单命令。 */
import {runAgentTaskDirectoryAction} from "./imports";
/** 用途：持久化会话；使用范围：首次目录绑定。 */
import {saveSession} from "./imports";
/** 用途：刷新发送按钮；使用范围：附件写入完成。 */
import {updateSendButtonState} from "./imports";
/** 用途：管理文件操作身份；使用范围：全部异步文件流程。 */
import {beginSessionFileOperation} from "./AgentChat.fileOperation";
/** 用途：结束文件操作；使用范围：全部异步文件流程。 */
import {finishSessionFileOperation} from "./AgentChat.fileOperation";
/** 用途：核对文件操作身份；使用范围：异步结果应用前。 */
import {isCurrentSessionFileOperation} from "./AgentChat.fileOperation";
/** 用途：报告文件错误；使用范围：菜单动作和上传结果。 */
import {reportSessionFileError} from "./AgentChat.fileOperation";

/**
 * 新会话首次绑定目录前创建会话文件。
 * 调用时机：目录控制器执行首次绑定前。
 */
export async function ensureCurrentSessionPersisted(runtime: AgentChatRuntime, sessionID: string) {
    // 只有仍处于当前原生 Agent 会话时才允许创建目录绑定所依赖的会话文件。
    if (runtime.conversationKind !== "native-agent" || sessionID !== runtime.sessionId) {
        throw new Error("The active session changed before directory binding");
    }
    // 已持久化的会话直接复用当前修订。
    if (runtime.sessionPorts.repository.getRevision(sessionID) > 0) {
        return;
    }
    await saveSession(runtime, undefined, true);
    // 保存后仍没有修订说明会话文件未成功建立，目录绑定不得继续。
    if (runtime.sessionPorts.repository.getRevision(sessionID) < 1) {
        throw new Error("Failed to create the agent session before directory binding");
    }
}

/** 执行当前会话的目录绑定动作，并在完成后刷新会话面板。 */
export async function runCurrentSessionTaskDirectoryAction(
    runtime: AgentChatRuntime,
    sessionID: string,
    action: TaskDirectoryMenuAction,
) {
    const requestTargetKind = runtime.conversationKind;
    const operationID = beginSessionFileOperation(runtime);
    try {
        await runAgentTaskDirectoryAction({
            repository: runtime.sessionPorts.taskDirectories,
            id: sessionID,
            action,
            beforeBind: () => ensureCurrentSessionPersisted(runtime, sessionID),
            onChanged: runtime.sessionPanel.refresh,
        });
        isCurrentSessionFileOperation(runtime, {
            operationID,
            sessionID,
            targetKind: requestTargetKind,
        });
    } finally {
        finishSessionFileOperation(runtime, operationID);
    }
}

/** 创建固定的附件上传菜单项。 */
function createUploadMenuItem(runtime: AgentChatRuntime) {
    const languages = window.siyuan.languages;
    return {
        label: `${languages.upload || "Upload"} ${languages.agentCatFile || "file"}`,
        icon: "iconUpload",
        click: () => {
            runtime.capabilities.closeMenu?.("agent-current-session-files");
            runtime.sessionFilesInput.click();
        },
    };
}

/**
 * 组合上传入口、目录授权摘要和可执行目录动作。
 * @同步豁免: 菜单端口要求在 popup 调用前同步返回完整菜单项数组，所有权限事实已经由上层异步加载。
 */
export function buildCurrentSessionFileMenuItems(runtime: AgentChatRuntime, input: Readonly<{
    sessionID: string;
    targetKind: AgentPanelConversationKind;
    canBindTaskDirectories: boolean | null;
    taskDirectory: TaskDirectoryBinding | null;
}>) {
    const items: PanelMenuItem[] = [createUploadMenuItem(runtime)];
    // 非原生目标或缺少 Kernel 能力时只暴露附件上传入口。
    if (input.targetKind !== "native-agent" || input.canBindTaskDirectories === null) {
        return items;
    }
    const session = {
        id: input.sessionID,
        title: runtime.sessionTitle,
        createdAt: runtime.sessionCreatedAt,
        updatedAt: Date.now(),
        ...(input.taskDirectory ? {taskDirectory: input.taskDirectory} : {}),
    };
    const actions = buildTaskDirectoryMenuActions(session, input.canBindTaskDirectories);
    for (const action of actions) {
        items.push({
            label: action.label,
            icon: action.icon,
            warning: action.action === "unbind",
            ...(action.disabled !== undefined ? {disabled: action.disabled} : {}),
            click: () => {
                // 摘要项只展示状态，不执行目录变更。
                if (action.action === "summary") {
                    return;
                }
                runtime.capabilities.closeMenu?.("agent-current-session-files");
                void runCurrentSessionTaskDirectoryAction(runtime, input.sessionID, action)
                    .catch((error) => reportSessionFileError(runtime, error));
            },
        });
    }
    return items;
}

/** 打开当前会话的文件与目录菜单。 */
export async function openSessionFilesMenu(runtime: AgentChatRuntime) {
    const showMenu = runtime.capabilities.showMenu;
    // 宿主未提供菜单端口时不执行能力查询。
    if (!showMenu) {
        return;
    }
    const requestSessionID = runtime.sessionId;
    const requestTargetKind = runtime.conversationKind;
    const operationID = beginSessionFileOperation(runtime);
    try {
        let canBindTaskDirectories: boolean | null = null;
        let taskDirectory: TaskDirectoryBinding | null = null;
        // 目录能力只适用于原生 Agent 会话。
        if (requestTargetKind === "native-agent") {
            [canBindTaskDirectories, taskDirectory] = await Promise.all([
                runtime.sessionPorts.taskDirectories.canBindTaskDirectories(),
                runtime.sessionPorts.taskDirectories.listTaskDirectories(requestSessionID),
            ]);
        }
        // 会话、目标或流式状态变化后丢弃已经过期的异步菜单结果。
        if (!isCurrentSessionFileOperation(runtime, {
            operationID,
            sessionID: requestSessionID,
            targetKind: requestTargetKind,
        }) || runtime.isStreaming) {
            return;
        }
        const items = buildCurrentSessionFileMenuItems(runtime, {
            sessionID: requestSessionID,
            targetKind: requestTargetKind,
            canBindTaskDirectories,
            taskDirectory,
        });
        showMenu("agent-current-session-files", runtime.sessionFilesBtn, items);
    } finally {
        finishSessionFileOperation(runtime, operationID);
    }
}

/** 校验上传结果并返回统一失败文本。 */
function validateUploadResult(result: AgentFileUploadResult) {
    const failureMessage = result.message || `${result.failed.join(", ")} ${window.siyuan.languages.uploadError}`;
    // 全部文件失败时由上层错误流程统一报告。
    if (result.uploaded.length === 0 && result.failed.length > 0) {
        throw new Error(failureMessage);
    }
    return failureMessage;
}

/** 把上传成功的附件链接写入当前编辑器。 */
function insertUploadedFiles(runtime: AgentChatRuntime, uploaded: AgentUploadedFile[]) {
    // 上传过程中编辑器被销毁时，结果不应静默丢失。
    if (!runtime.composer) {
        throw new Error("Agent Composer is not available after file upload");
    }
    const prefix = hasComposerInput(runtime) ? "\n" : "";
    runtime.composer.insertText(prefix + uploaded.map(formatAgentUploadedFileMarkdown).join("\n") + " ");
    runtime.composer.focus();
    updateSendButtonState(runtime);
    runtime.capabilities.showMessage?.(`${window.siyuan.languages.upload}: ${uploaded.length}`, 2000);
}

/** 上传文件并把生成的 Markdown 链接写入编辑器。 */
export async function uploadSessionFiles(runtime: AgentChatRuntime, files: File[]) {
    const requestSessionID = runtime.sessionId;
    const requestTargetKind = runtime.conversationKind;
    const operationID = beginSessionFileOperation(runtime);
    try {
        const result = await runtime.sessionPorts.uploadFiles(files);
        // 会话或目标变化后丢弃已经过期的上传结果。
        if (!isCurrentSessionFileOperation(runtime, {
            operationID,
            sessionID: requestSessionID,
            targetKind: requestTargetKind,
        })) {
            return;
        }
        const failureMessage = validateUploadResult(result);
        // 用户没有选择有效文件时保持编辑器不变。
        if (result.uploaded.length === 0) {
            return;
        }
        insertUploadedFiles(runtime, result.uploaded);
        // 部分文件失败时保留成功链接，并额外报告失败项。
        if (result.failed.length > 0) {
            reportSessionFileError(runtime, new Error(failureMessage));
        }
    } finally {
        finishSessionFileOperation(runtime, operationID);
    }
}
