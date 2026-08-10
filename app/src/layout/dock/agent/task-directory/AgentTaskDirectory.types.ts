/** 外部任务目录支持的权限级别。 */
export type TaskDirectoryPermission = "read-only" | "read-write" | "command";

/** 会话已绑定的外部任务目录摘要。 */
export interface TaskDirectoryGrant {
    id: string;
    name: string;
    permission: TaskDirectoryPermission;
    external: boolean;
    boundAt: number;
}

/** 会话的主目录和附加目录 capability 摘要。 */
export interface TaskDirectoryBinding {
    main?: TaskDirectoryGrant;
    directories?: TaskDirectoryGrant[];
}

/** 会话面板可执行的目录命令。 */
export interface TaskDirectoryMenuAction {
    action: "bind-main" | "add" | "unbind" | "summary";
    icon: string;
    label: string;
    disabled?: boolean;
    permission?: TaskDirectoryPermission;
    directoryID?: string;
}

/** 任务目录领域的完整读写能力。 */
export interface AgentTaskDirectoryRepository {
    canBindTaskDirectories(): Promise<boolean>;
    listTaskDirectories(id: string): Promise<TaskDirectoryBinding | null>;
    bindTaskDirectory(id: string, path: string): Promise<TaskDirectoryBinding>;
    /** Bind a directory already exposed by the file browser without sending an absolute path. */
    bindFileBrowserTaskDirectory?(input: Readonly<{
        id: string;
        rootID: string;
        path: string;
    }>): Promise<TaskDirectoryBinding>;
    addTaskDirectory(input: Readonly<{
        id: string;
        path: string;
        permission: TaskDirectoryPermission;
    }>): Promise<TaskDirectoryBinding>;
    unbindTaskDirectory(id: string, directoryID?: string): Promise<void>;
}
