/** 用途：查询 Agent Dock；使用范围：文件浏览器创建任务动作。 */
import {getDockByType} from "../../layout/query/dockByType";
/** 用途：约束 Agent Dock 公开任务能力；使用范围：跨领域动作边界。 */
import type {AgentChatDomain} from "../../layout/dock/agent/runtime/public/AgentChat.types";
/** 用途：约束文件根来源；使用范围：目录绑定资格判断。 */
import type {FileBrowserRoot} from "./FileBrowser.types";

type FileBrowserAgentChat = AgentChatDomain & {
    createTaskFromDirectory(input: Readonly<{rootID: string; path: string; title?: string}>): Promise<void>;
    createTaskFromFiles(files: File[], title?: string): Promise<void>;
};

function normalizePath(path: string) {
    return path.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

/** 判断一个浏览器地址是否由外部 Agent 根或归并挂载提供。 */
export function canCreateFileBrowserAgentDirectory(root: FileBrowserRoot, path: string) {
    if (root.kind === "agent-task-directory") {
        return true;
    }
    const normalized = normalizePath(path);
    return (root.mounts ?? []).some(mount => mount.kind === "agent-task-directory" && (
        normalized === normalizePath(mount.relativePath) ||
        normalized.startsWith(`${normalizePath(mount.relativePath)}/`)
    ));
}

function resolveAgentChat() {
    const dock = getDockByType("agentChat");
    if (!dock) {
        throw new Error("Agent 面板当前不可用");
    }
    dock.toggleModel("agentChat", true, false, false, false);
    const model = dock.data.agentChat;
    if (!model || typeof (model as Partial<FileBrowserAgentChat>).createTaskFromDirectory !== "function" ||
        typeof (model as Partial<FileBrowserAgentChat>).createTaskFromFiles !== "function") {
        throw new Error("Agent 面板尚未提供文件浏览任务能力");
    }
    return model as FileBrowserAgentChat;
}

/** 在 Agent 面板创建一个绑定文件浏览根内目录的新任务。 */
export async function createFileBrowserAgentDirectoryTask(input: Readonly<{
    root: FileBrowserRoot;
    rootID: string;
    path: string;
    title?: string;
}>) {
    if (!canCreateFileBrowserAgentDirectory(input.root, input.path)) {
        throw new Error("当前目录不是已授权的 Agent 任务根");
    }
    await resolveAgentChat().createTaskFromDirectory({
        rootID: input.rootID,
        path: input.path,
        ...(input.title ? {title: input.title} : {}),
    });
}

/** 从受控 contentURL 读取真实文件并在 Agent 面板创建附件任务。 */
export async function createFileBrowserAgentFileTask(input: Readonly<{
    name: string;
    contentURL: string;
    mediaType?: string;
}>) {
    const response = await fetch(input.contentURL);
    if (!response.ok) {
        throw new Error(`读取附件失败：HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const file = new File([blob], input.name, {
        type: input.mediaType?.trim() || blob.type || "application/octet-stream",
    });
    await resolveAgentChat().createTaskFromFiles([file], input.name);
}
