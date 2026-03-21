/** 工作空间 AI 主笔记本状态枚举。用途：描述 MAGI 守卫页面的状态机；使用场景：MagiRoot 与 AI 主笔记本 service 共享状态值；关联类型：与 WorkspaceAIMainNotebookState 配合使用。 */
export type WorkspaceAIMainNotebookStatus = "missing" | "ready" | "conflict" | "inactive";

/**
 * 工作空间 AI 主笔记本信息。
 *
 * 用途：描述单个 AI 主笔记本的最小展示信息。
 * 使用场景：守卫界面展示候选笔记本、状态同步时记录 active/open 列表。
 * 关联类型：由 WorkspaceAIMainNotebookState 的 notebooks/openNotebooks/activeNotebook 引用。
 */
export interface WorkspaceAIMainNotebookInfo {
    id: string;
    name: string;
    closed: boolean;
    icon: string;
    sort: number;
    sortMode: number;
    aiMainNotebook: boolean;
}

/**
 * 工作空间 AI 主笔记本状态。
 *
 * 用途：承载 MAGI 启动前的工作空间准入状态。
 * 使用场景：MagiRoot 根据该状态决定显示守卫页还是正式工作区。
 * 关联类型：status 使用 WorkspaceAIMainNotebookStatus，列表项使用 WorkspaceAIMainNotebookInfo。
 */
export interface WorkspaceAIMainNotebookState {
    status: WorkspaceAIMainNotebookStatus;
    notebooks: WorkspaceAIMainNotebookInfo[];
    openNotebooks: WorkspaceAIMainNotebookInfo[];
    activeNotebook: WorkspaceAIMainNotebookInfo | null;
}
