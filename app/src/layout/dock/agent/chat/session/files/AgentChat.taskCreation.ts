/** 用途：约束聊天运行时；使用范围：文件浏览器创建 Agent 任务。 */
import type {AgentChatRuntime, AgentSession} from "./imports";
/** 用途：复用附件 Markdown 协议；使用范围：新任务附件草稿。 */
import {formatAgentUploadedFileMarkdown} from "./imports";
/** 用途：切换到新建会话；使用范围：任务创建完成后的面板更新。 */
import {openConversation, setDraft} from "../../ui/lifecycle/AgentChat.facade";

export interface FileBrowserAgentDirectoryTarget {
    rootID: string;
    path: string;
    title?: string;
}

function taskTitle(runtime: AgentChatRuntime, title: string | undefined) {
    return title?.trim() || runtime.defaultTitle;
}

function createEmptyNativeSession(runtime: AgentChatRuntime, title: string | undefined): AgentSession {
    const now = Date.now();
    return {
        id: runtime.sessionPorts.repository.newSessionId(),
        title: taskTitle(runtime, title),
        targetKind: "native-agent",
        titled: Boolean(title?.trim()),
        entries: [],
        messageHistory: [],
        createdAt: now,
        updatedAt: now,
    };
}

async function persistEmptySession(runtime: AgentChatRuntime, session: AgentSession) {
    const result = await runtime.sessionPorts.repository.save(session);
    if (result.revision < 1) {
        throw new Error("The new Agent session was not persisted");
    }
}

async function removeUnopenedSession(runtime: AgentChatRuntime, sessionID: string) {
    try {
        await runtime.sessionPorts.repository.remove(sessionID);
    } catch (cleanupError) {
        console.error("[agent-task] failed to remove an unopened session", cleanupError);
    }
}

function assertTaskCreationAllowed(runtime: AgentChatRuntime) {
    if (runtime.isStreaming || runtime.currentTurnID) {
        throw new Error("Create the Agent task after the current turn finishes");
    }
    if (runtime.conversationKind !== "native-agent") {
        throw new Error("File-browser tasks require the native Agent target");
    }
}

/** 创建独立空会话并通过 root-relative 文件浏览端口绑定任务目录。 */
export async function createTaskFromDirectory(
    runtime: AgentChatRuntime,
    input: FileBrowserAgentDirectoryTarget,
) {
    await runtime.initialization;
    assertTaskCreationAllowed(runtime);
    if (!input.rootID.trim()) {
        throw new Error("The Agent task directory root is empty");
    }
    const session = createEmptyNativeSession(runtime, input.title);
    let opened = false;
    try {
        await persistEmptySession(runtime, session);
        const bind = runtime.sessionPorts.taskDirectories.bindFileBrowserTaskDirectory;
        if (!bind) {
            throw new Error("File-browser Agent task binding is unavailable");
        }
        await bind({id: session.id, rootID: input.rootID, path: input.path});
        await openConversation(runtime, {kind: "native-agent", sessionId: session.id});
        opened = true;
    } catch (error) {
        if (!opened) {
            await removeUnopenedSession(runtime, session.id);
        }
        throw error;
    }
}

/** 创建独立空会话、上传真实附件，并把真实 Markdown 地址放入新会话草稿。 */
export async function createTaskFromFiles(
    runtime: AgentChatRuntime,
    files: File[],
    title?: string,
) {
    await runtime.initialization;
    assertTaskCreationAllowed(runtime);
    if (files.length === 0) {
        throw new Error("No file was selected for the Agent task");
    }
    const session = createEmptyNativeSession(runtime, title);
    let opened = false;
    try {
        await persistEmptySession(runtime, session);
        const upload = await runtime.sessionPorts.uploadFiles(files);
        if (upload.uploaded.length === 0) {
            throw new Error(upload.message || `Agent attachment upload failed: ${upload.failed.join(", ")}`);
        }
        await openConversation(runtime, {kind: "native-agent", sessionId: session.id});
        opened = true;
        await setDraft(runtime, upload.uploaded.map(formatAgentUploadedFileMarkdown).join("\n") + " ");
        if (upload.failed.length > 0) {
            runtime.capabilities.showMessage?.(
                `部分附件上传失败：${upload.failed.join("、")}`,
                5000,
            );
        }
    } catch (error) {
        if (!opened) {
            await removeUnopenedSession(runtime, session.id);
        }
        throw error;
    }
}
