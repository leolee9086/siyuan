/** 用途：初始化 MAGI 运行时；使用范围：工作空间守卫通过后的启动流程；解耦评估：已通过同目录 imports.ts 转发 composable 启动入口，符合导入规约。 */
import { useMagi } from "./imports";
/** 用途：读取工作空间 AI 主笔记本状态；使用范围：守卫初始化与刷新动作；解耦评估：service 能力已在 imports.ts 收口，当前依赖边界清晰。 */
import { fetchWorkspaceAIMainNotebookState } from "./imports";
/** 用途：创建工作空间 AI 主笔记本；使用范围：守卫页缺失态创建动作；解耦评估：service 能力已在 imports.ts 收口，当前依赖边界清晰。 */
import { createWorkspaceAIMainNotebook } from "./imports";
/** 用途：打开工作空间 AI 主笔记本；使用范围：检测到活跃主笔记本关闭时补偿打开；解耦评估：service 能力已在 imports.ts 收口，当前依赖边界清晰。 */
import { openWorkspaceAIMainNotebook } from "./imports";
/** 用途：解决工作空间 AI 主笔记本冲突；使用范围：守卫页冲突态选择保留笔记本；解耦评估：service 能力已在 imports.ts 收口，当前依赖边界清晰。 */
import { resolveWorkspaceAIMainNotebookConflict } from "./imports";
/** 用途：展示界面消息提示；使用范围：工作空间冲突提示；解耦评估：UI 消息能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { showMessage } from "./imports";
/** 用途：标注工作空间 AI 主笔记本状态；使用范围：状态更新与守卫判断；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WorkspaceAIMainNotebookState } from "./imports";
/** 用途：标注工作空间 AI 主笔记本状态字面量；使用范围：冲突提示函数参数类型约束；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { WorkspaceAIMainNotebookStatus } from "./imports";
/** 用途：标注 rootctx 状态工厂；使用范围：workspace 模块通过 ReturnType 推导完整状态结构；解耦评估：纯类型依赖，直接依赖同目录状态模块合理。 */
import type { createMagiRootState } from "./MagiRoot.state";

/**
 * 作用：把未知异常转换为可展示文本。
 * 意图：统一 workspace 守卫与启动流程的错误落盘格式。
 * 调用时机：workspace 请求或 useMagi 初始化抛错时调用。
 */
function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

/**
 * 作用：判断是否需要提示“仅允许一个 AI 主笔记本处于打开状态”。
 * 意图：把冲突提示的环境判断收敛为单点逻辑，避免重复编写 window 防御。
 * 调用时机：工作空间 AI 主笔记本状态切换后调用。
 */
function shouldNotifyWorkspaceConflict(status: WorkspaceAIMainNotebookStatus) {
    return status === "conflict";
}

/**
 * 作用：在状态进入冲突态时向用户展示提示。
 * 意图：让守卫页外的后台刷新也能给出明确反馈。
 * 调用时机：`setWorkspaceAIMainNotebookState` 检测到状态切换时调用。
 */
function notifyWorkspaceAIMainNotebookConflict(status: WorkspaceAIMainNotebookStatus) {
    if (!shouldNotifyWorkspaceConflict(status)) {
        return;
    }
    showMessage(
        "同一工作空间同一时间只能有一个 AI 主笔记本处于打开状态，请选择一个保持打开。",
        7000,
        "info",
    );
}

/**
 * 作用：判断活跃 AI 主笔记本是否需要被补偿打开。
 * 意图：避免 UI 误以为守卫已通过，但实际可访问范围仍处于关闭状态。
 * 调用时机：刷新工作空间 AI 主笔记本状态后调用。
 */
function shouldReopenClosedActiveNotebook(nextState: WorkspaceAIMainNotebookState) {
    return nextState.status === "ready" && Boolean(nextState.activeNotebook?.closed);
}

/**
 * 作用：读取需要被补偿打开的活跃 AI 主笔记本 ID。
 * 意图：把“需要打开 + 能拿到 ID”两个条件合并为单点逻辑，避免刷新流程出现嵌套 if。
 * 调用时机：刷新工作空间 AI 主笔记本状态后调用。
 */
function getClosedActiveNotebookId(nextState: WorkspaceAIMainNotebookState) {
    const activeNotebook = nextState.activeNotebook;
    if (!shouldReopenClosedActiveNotebook(nextState) || !activeNotebook) {
        return null;
    }
    return activeNotebook.id;
}

/**
 * 作用：判断在工作空间状态已 ready 后是否还需要启动 MAGI 运行时。
 * 意图：避免重复初始化，同时保证首次 ready 时会补做启动。
 * 调用时机：工作空间状态刷新/创建/冲突解决成功后调用。
 */
function shouldBootstrapMagiAfterWorkspaceReady(
    state: ReturnType<typeof createMagiRootState>,
    nextState: WorkspaceAIMainNotebookState,
) {
    return nextState.status === "ready" && (!state.ready.value || !state.magiState.value);
}

/**
 * 作用：将最新 AI 主笔记本状态写回 rootctx。
 * 意图：集中处理状态赋值和冲突提示，避免各调用点重复实现。
 * 调用时机：读取、创建、冲突解决接口成功后调用。
 */
function setWorkspaceAIMainNotebookState(
    state: ReturnType<typeof createMagiRootState>,
    nextState: WorkspaceAIMainNotebookState,
) {
    const previousStatus = state.workspaceAIMainNotebookState.value?.status ?? null;
    state.workspaceAIMainNotebookState.value = nextState;
    state.workspaceAIMainNotebookError.value = null;
    // 只有状态真正变化时才弹提示，避免轮询刷新期间重复打扰用户。
    if (previousStatus !== nextState.status) {
        notifyWorkspaceAIMainNotebookConflict(nextState.status);
    }
}

/**
 * 作用：执行 useMagi 初始化并同步 ready/bootError。
 * 意图：把 MAGI 启动副作用与错误处理集中，避免多个 handler 分散维护。
 * 调用时机：工作空间守卫 ready 且尚未完成运行时初始化时调用。
 */
export async function bootstrapMagiState(state: ReturnType<typeof createMagiRootState>) {
    if (state.destroyed.value) {
        return;
    }
    // 如果运行时已经初始化完成，则无需再次触发 useMagi，只同步 ready/error 即可。
    if (state.magiState.value) {
        state.ready.value = true;
        state.bootError.value = null;
        return;
    }

    state.bootError.value = null;
    try {
        const runtime = await useMagi();
        // Vue 宿主可能在异步初始化期间卸载，此时立即释放刚创建的运行时，避免 websocket 残留。
        if (state.destroyed.value) {
            runtime.destroy();
            return;
        }
        state.magiState.value = runtime;
        state.ready.value = true;
    } catch (error) {
        state.ready.value = false;
        state.bootError.value = getErrorMessage(error);
    }
}

/**
 * 作用：刷新工作空间 AI 主笔记本状态并在必要时补偿打开活跃笔记本。
 * 意图：保证守卫层看到的 ready 状态与实际可访问状态一致。
 * 调用时机：启动守卫、手动刷新、提交前确保工作空间 ready 时调用。
 */
export async function refreshWorkspaceAIMainNotebookState(
    state: ReturnType<typeof createMagiRootState>,
) {
    state.workspaceAIMainNotebookLoading.value = true;
    state.workspaceAIMainNotebookError.value = null;

    try {
        let nextState = await fetchWorkspaceAIMainNotebookState();
        const closedActiveNotebookId = getClosedActiveNotebookId(nextState);
        // 某些情况下后端会返回 ready 但活跃主笔记本仍处于关闭态，这里补做一次自动打开。
        if (closedActiveNotebookId) {
            await openWorkspaceAIMainNotebook(closedActiveNotebookId);
            nextState = await fetchWorkspaceAIMainNotebookState();
        }
        setWorkspaceAIMainNotebookState(state, nextState);
        return nextState;
    } catch (error) {
        state.workspaceAIMainNotebookError.value = getErrorMessage(error);
        return null;
    } finally {
        state.workspaceAIMainNotebookLoading.value = false;
    }
}

/**
 * 作用：确保工作空间 AI 主笔记本处于 ready 状态。
 * 意图：为提交消息、重连等动作提供统一的前置守卫。
 * 调用时机：主输入提交、重连等依赖工作空间可访问范围的动作触发前调用。
 */
export async function ensureWorkspaceAIMainNotebookReady(
    state: ReturnType<typeof createMagiRootState>,
) {
    const nextState = await refreshWorkspaceAIMainNotebookState(state);
    return nextState?.status === "ready";
}

/**
 * 作用：在工作空间状态 ready 后补做 MAGI 启动。
 * 意图：复用刷新/创建/冲突解决三条链路的“ready 后启动”逻辑。
 * 调用时机：工作空间状态变化成功后调用。
 */
async function bootstrapMagiIfNeeded(
    state: ReturnType<typeof createMagiRootState>,
    nextState: WorkspaceAIMainNotebookState,
) {
    state.bootError.value = null;
    // 仅在工作空间已 ready 且运行时尚未可用时才补做启动，避免刷新动作反复重连。
    if (shouldBootstrapMagiAfterWorkspaceReady(state, nextState)) {
        await bootstrapMagiState(state);
    }
}

/**
 * 作用：执行启动阶段的工作空间守卫流程。
 * 意图：把“先检查工作空间，再启动 MAGI”这条主链路集中到单独模块。
 * 调用时机：`useMagiRootContext` 构造完成后立即异步调用一次。
 */
export async function bootstrapWorkspaceAIMainNotebookGuard(
    state: ReturnType<typeof createMagiRootState>,
) {
    state.ready.value = false;
    state.bootError.value = null;

    const nextState = await refreshWorkspaceAIMainNotebookState(state);
    if (!nextState) {
        state.bootError.value = state.workspaceAIMainNotebookError.value;
        return;
    }

    if (nextState.status !== "ready") {
        return;
    }

    await bootstrapMagiState(state);
}

/**
 * 作用：处理“重新检查工作空间 AI 主笔记本状态”动作。
 * 意图：避免入口层直接操作 workspace 状态细节。
 * 调用时机：守卫页点击“重新检查”按钮时调用。
 */
async function handleRefreshWorkspaceAIMainNotebookState(
    state: ReturnType<typeof createMagiRootState>,
) {
    if (state.workspaceAIMainNotebookActionLoading.value) {
        return false;
    }

    const nextState = await refreshWorkspaceAIMainNotebookState(state);
    if (!nextState) {
        return false;
    }

    await bootstrapMagiIfNeeded(state, nextState);
    return nextState.status === "ready";
}

/**
 * 作用：处理“创建工作空间 AI 主笔记本”动作。
 * 意图：把加载态、错误态和 ready 后启动逻辑集中管理。
 * 调用时机：守卫页缺失态点击创建按钮时调用。
 */
async function handleCreateWorkspaceAIMainNotebook(
    state: ReturnType<typeof createMagiRootState>,
    name?: string,
) {
    if (state.workspaceAIMainNotebookActionLoading.value) {
        return;
    }

    state.workspaceAIMainNotebookActionLoading.value = true;
    state.workspaceAIMainNotebookError.value = null;
    try {
        const nextState = await createWorkspaceAIMainNotebook(name);
        setWorkspaceAIMainNotebookState(state, nextState);
        await bootstrapMagiIfNeeded(state, nextState);
    } catch (error) {
        state.workspaceAIMainNotebookError.value = getErrorMessage(error);
    } finally {
        state.workspaceAIMainNotebookActionLoading.value = false;
    }
}

/**
 * 作用：处理“解决工作空间 AI 主笔记本冲突”动作。
 * 意图：复用与创建动作一致的状态管理与 ready 后启动逻辑。
 * 调用时机：守卫页冲突态点击保留某个笔记本时调用。
 */
async function handleResolveWorkspaceAIMainNotebook(
    state: ReturnType<typeof createMagiRootState>,
    keepNotebook: string,
) {
    if (state.workspaceAIMainNotebookActionLoading.value) {
        return;
    }

    state.workspaceAIMainNotebookActionLoading.value = true;
    state.workspaceAIMainNotebookError.value = null;
    try {
        const nextState = await resolveWorkspaceAIMainNotebookConflict(keepNotebook);
        setWorkspaceAIMainNotebookState(state, nextState);
        await bootstrapMagiIfNeeded(state, nextState);
    } catch (error) {
        state.workspaceAIMainNotebookError.value = getErrorMessage(error);
    } finally {
        state.workspaceAIMainNotebookActionLoading.value = false;
    }
}

/**
 * 作用：创建“重新检查工作空间 AI 主笔记本状态” handler。
 * 意图：把守卫页动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createWorkspaceNotebookHandlers` 组装 handler 时调用。
 */
function createRefreshWorkspaceAIMainNotebookStateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return async () => handleRefreshWorkspaceAIMainNotebookState(state);
}

/**
 * 作用：创建“创建工作空间 AI 主笔记本” handler。
 * 意图：把守卫页动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createWorkspaceNotebookHandlers` 组装 handler 时调用。
 */
function createWorkspaceAIMainNotebookCreateHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return async (name?: string) => handleCreateWorkspaceAIMainNotebook(state, name);
}

/**
 * 作用：创建“解决工作空间 AI 主笔记本冲突” handler。
 * 意图：把守卫页动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createWorkspaceNotebookHandlers` 组装 handler 时调用。
 */
function createWorkspaceAIMainNotebookResolveHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return async (keepNotebook: string) => handleResolveWorkspaceAIMainNotebook(state, keepNotebook);
}

/**
 * 作用：创建工作空间 AI 主笔记本相关 handler 集合。
 * 意图：把守卫页动作装配与入口层解耦。
 * 调用时机：`createMagiRootHandlers` 组装事件处理器时调用。
 */
/** @同步豁免: UI构建 — setup 阶段需要同步返回守卫页事件处理器闭包。 */
export function createWorkspaceNotebookHandlers(
    state: ReturnType<typeof createMagiRootState>,
) {
    return {
        onRefreshWorkspaceAIMainNotebookState: createRefreshWorkspaceAIMainNotebookStateHandler(state),
        onCreateWorkspaceAIMainNotebook: createWorkspaceAIMainNotebookCreateHandler(state),
        onResolveWorkspaceAIMainNotebook: createWorkspaceAIMainNotebookResolveHandler(state),
    };
}
