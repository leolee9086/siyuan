/** 用途：向共识消息流追加反馈；使用范围：导出详细记录成功/失败提示；解耦评估：已通过同目录 imports.ts 转发消息能力，当前依赖边界清晰。 */
import { appendConsensusMessage } from "./imports";
/** 用途：导出 MAGI 会话详细记录；使用范围：EXPORT LOG 动作；解耦评估：导出能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { exportMagiSessionRecord } from "./imports";
/** 用途：标注 rootctx 状态工厂；使用范围：主动作模块通过 ReturnType 推导完整状态结构；解耦评估：纯类型依赖，直接依赖同目录状态模块合理。 */
import type { createMagiRootState } from "./MagiRoot.state";
/** 用途：确保工作空间 AI 主笔记本 ready；使用范围：主输入提交与重连前置守卫；解耦评估：同目录 workspace 模块已封装守卫逻辑，直接依赖合理。 */
import { ensureWorkspaceAIMainNotebookReady } from "./MagiRoot.workspace";

/**
 * 作用：把未知异常转换为可展示文本。
 * 意图：统一主动作模块里的错误提示格式。
 * 调用时机：导出详细记录失败时调用。
 */
function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

/**
 * 作用：打开人格问卷入口面板。
 * 意图：把问卷入口状态切换从入口层抽离出来，保持事件语义清晰。
 * 调用时机：标题栏点击 Persona 按钮时调用。
 */
async function handleShowQuestionnaire(state: ReturnType<typeof createMagiRootState>) {
    state.showQuestionnairePanel.value = true;
}

/**
 * 作用：处理 MAGI 重连动作。
 * 意图：在不刷新页面的前提下，给用户提供显式恢复入口。
 * 调用时机：标题栏点击 RECONNECT 按钮时调用。
 */
async function handleReconnect(state: ReturnType<typeof createMagiRootState>) {
    if (!state.magiState.value) {
        return;
    }

    if (!await ensureWorkspaceAIMainNotebookReady(state)) {
        return;
    }

    await state.magiState.value.initializeMAGI();
}

/**
 * 作用：导出 MAGI 会话详细记录，并把结果写回共识消息流。
 * 意图：让导出结果在主界面可追踪，而不是仅依赖系统对话框。
 * 调用时机：标题栏点击 EXPORT LOG 按钮时调用。
 */
async function handleExportSessionRecord(state: ReturnType<typeof createMagiRootState>) {
    if (!state.magiState.value) {
        return;
    }

    try {
        const { filePath } = await exportMagiSessionRecord({
            seels: state.magiState.value.seels,
            consensusMessages: state.magiState.value.consensusMessages,
            connectionStatus: state.magiState.value.connectionStatus,
            mode: "sanitized",
        });
        await appendConsensusMessage(
            state.magiState.value.consensusMessages,
            "system",
            `MAGI详细记录已导出: ${filePath}`,
        );
    } catch (error) {
        const message = getErrorMessage(error);
        await appendConsensusMessage(
            state.magiState.value.consensusMessages,
            "error",
            `MAGI详细记录导出失败: ${message}`,
        );
    }
}

/**
 * 作用：创建 MagiRoot 主动作 handlers 集合。
 * 意图：让入口层只负责装配，而不直接关心动作实现细节。
 * 调用时机：`createMagiRootHandlers` 组装最终 handler 时调用。
 */
/**
 * 作用：创建“打开问卷入口面板” handler。
 * 意图：把问卷入口动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createMagiRootActionHandlers` 组装 handler 时调用。
 */
function createShowQuestionnaireHandler(state: ReturnType<typeof createMagiRootState>) {
    return async () => handleShowQuestionnaire(state);
}

/**
 * 作用：创建“关闭问卷入口面板” handler。
 * 意图：把问卷入口关闭动作与 rootctx 状态闭包绑定，同时保持入口层装配简洁。
 * 调用时机：`createMagiRootActionHandlers` 组装 handler 时调用。
 */
function createCloseQuestionnaireHandler(state: ReturnType<typeof createMagiRootState>) {
    return () => {
        state.showQuestionnairePanel.value = false;
    };
}

/**
 * 作用：创建“重连 MAGI” handler。
 * 意图：把重连动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createMagiRootActionHandlers` 组装 handler 时调用。
 */
function createReconnectHandler(state: ReturnType<typeof createMagiRootState>) {
    return async () => handleReconnect(state);
}

/**
 * 作用：创建“导出详细记录” handler。
 * 意图：把导出动作与 rootctx 状态闭包绑定，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createMagiRootActionHandlers` 组装 handler 时调用。
 */
function createExportSessionRecordHandler(state: ReturnType<typeof createMagiRootState>) {
    return async () => handleExportSessionRecord(state);
}

/**
 * 作用：创建 MagiRoot 主动作 handlers 集合。
 * 意图：让入口层只负责装配，而不直接关心动作实现细节。
 * 调用时机：`createMagiRootHandlers` 组装最终 handler 时调用。
 */
/** @同步豁免: UI构建 — setup 阶段需要同步返回主动作处理器闭包。 */
export function createMagiRootActionHandlers(
    state: ReturnType<typeof createMagiRootState>,
) {
    return {
        onShowQuestionnaire: createShowQuestionnaireHandler(state),
        onCloseQuestionnaire: createCloseQuestionnaireHandler(state),
        onReconnect: createReconnectHandler(state),
        onExportSessionRecord: createExportSessionRecordHandler(state),
    };
}
