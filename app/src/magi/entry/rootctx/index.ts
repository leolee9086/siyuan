/** 用途：创建计算属性；使用范围：showWindowControls 视图开关；解耦评估：Vue 计算属性 API 已通过 imports.ts 收口，当前依赖边界清晰。 */
import { computed } from "./imports";
/** 用途：侦听响应式变化；使用范围：showWindowControls 视图开关的副作用；解耦评估：Vue 侦听 API 已通过 imports.ts 收口，当前依赖边界清晰。 */
import { watch } from "./imports";
/** 用途：读取 Electron 环境标志；使用范围：窗口控制显示条件；解耦评估：平台能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { isElectron } from "./imports";
/** 用途：读取移动端环境标志；使用范围：窗口控制显示条件；解耦评估：平台能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { isMobile } from "./imports";
/** 用途：标注 MagiRoot 最终上下文结构；使用范围：校验 `useMagiRootContext` 返回值；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { MagiRootContext } from "./imports";
/** 用途：创建 rootctx 基础响应式状态；使用范围：MagiRoot 上下文初始化；解耦评估：同目录状态模块职责单一，直接依赖合理。 */
import { createMagiRootState } from "./MagiRoot.state";
/** 用途：创建 MagiRoot 视图层计算属性；使用范围：MagiRoot 上下文初始化；解耦评估：同目录 computed 模块职责单一，直接依赖合理。 */
import { createMagiRootComputed } from "./MagiRoot.computed";
/** 用途：创建 MagiRoot handlers 集合；使用范围：MagiRoot 上下文初始化；解耦评估：同目录 handlers 模块职责单一，直接依赖合理。 */
import { createMagiRootHandlers } from "./MagiRoot.handlers";
/** 用途：执行启动阶段工作空间守卫；使用范围：MagiRoot 上下文构造完成后的异步引导；解耦评估：同目录 workspace 模块已封装守卫逻辑，直接依赖合理。 */
import { bootstrapWorkspaceAIMainNotebookGuard } from "./MagiRoot.workspace";
/** 用途：主面板聊天记录前端缓存；使用范围：useMagiRootContext 中挂载缓存持久化逻辑；解耦评估：utils 层已封装 localStorage 操作，直接依赖合理。 */
import { loadChatHistory } from "../../utils/chatHistoryCache";
/** 用途：主面板聊天记录前端缓存；使用范围：useMagiRootContext 中挂载缓存持久化逻辑；解耦评估：utils 层已封装 localStorage 操作，直接依赖合理。 */
import { saveChatHistory } from "../../utils/chatHistoryCache";
/** 用途：标注缓存消息类型；使用范围：缓存加载时的类型适配；解耦评估：纯类型依赖，直接导入合理。 */
import type { CachedMessage } from "../../utils/chatHistoryCache";

/**
 * 作用：创建占位的停止输入 handler。
 * 意图：为模板保留统一事件接口，同时明确当前实现尚无实际停止逻辑。
 * 调用时机：上下文装配最终 handler 集合时调用。
 */
function createStopInputHandler() {
    return () => {
        // no-op
    };
}

/**
 * 作用：装配 MagiRoot 的基础响应式状态片段。
 * 意图：让最终上下文对象按职责分段组装，提升可读性。
 * 调用时机：`useMagiRootContext` 返回最终上下文前调用。
 */
function createCoreContext(state: ReturnType<typeof createMagiRootState>) {
    return {
        ready: state.ready,
        bootError: state.bootError,
        inputValue: state.inputValue,
        showMessages: state.showMessages,
        showSeels: state.showSeels,
        showMonitor: state.showMonitor,
        showQuestionnairePanel: state.showQuestionnairePanel,
        sourceSimulationProfiles: state.sourceSimulationProfiles,
        sourceSimulationPanels: state.sourceSimulationPanels,
        magiState: state.magiState,
    };
}

/**
 * 作用：装配工作空间守卫相关上下文片段。
 * 意图：把 notebook 守卫相关字段从其余视图状态中分离，降低入口函数阅读成本。
 * 调用时机：`useMagiRootContext` 返回最终上下文前调用。
 */
function createNotebookContext(
    state: ReturnType<typeof createMagiRootState>,
    computedState: ReturnType<typeof createMagiRootComputed>,
) {
    return {
        workspaceAIMainNotebookState: state.workspaceAIMainNotebookState,
        workspaceAIMainNotebookStatus: computedState.workspaceAIMainNotebookStatus,
        workspaceAIMainNotebookLoading: state.workspaceAIMainNotebookLoading,
        workspaceAIMainNotebookActionLoading: state.workspaceAIMainNotebookActionLoading,
        workspaceAIMainNotebookError: state.workspaceAIMainNotebookError,
    };
}

/**
 * 作用：装配视图层派生状态片段。
 * 意图：把运行时到 UI 的映射结果与基础状态隔离，便于后续继续拆分。
 * 调用时机：`useMagiRootContext` 返回最终上下文前调用。
 */
function createRuntimeViewContext(
    computedState: ReturnType<typeof createMagiRootComputed>,
) {
    return {
        seels: computedState.seels,
        mainPanelSeels: computedState.mainPanelSeels,
        sageSeels: computedState.sageSeels,
        monitorHostSeel: computedState.monitorHostSeel,
        sageSeelViews: computedState.sageSeelViews,
        monitorSeelView: computedState.monitorSeelView,
        displayMessages: computedState.displayMessages,
        isMainPanelRequestPending: computedState.isMainPanelRequestPending,
        isAnySeelLoading: computedState.isAnySeelLoading,
        runtimeStatus: computedState.runtimeStatus,
        showWindowControls: computed(() => isElectron && !isMobile),
    };
}

/**
 * 作用：装配事件处理器片段。
 * 意图：让最终上下文对象的事件接口与状态接口分开组织，方便维护。
 * 调用时机：`useMagiRootContext` 返回最终上下文前调用。
 */
function createHandlerContext(handlers: ReturnType<typeof createMagiRootHandlers>) {
    return {
        onSubmitInput: handlers.onSubmitInput,
        onShowQuestionnaire: handlers.onShowQuestionnaire,
        onCloseQuestionnaire: handlers.onCloseQuestionnaire,
        onQuestionnaireSaved: handlers.onQuestionnaireSaved,
        onRefreshWorkspaceAIMainNotebookState: handlers.onRefreshWorkspaceAIMainNotebookState,
        onCreateWorkspaceAIMainNotebook: handlers.onCreateWorkspaceAIMainNotebook,
        onResolveWorkspaceAIMainNotebook: handlers.onResolveWorkspaceAIMainNotebook,
        onReconnect: handlers.onReconnect,
        onExportSessionRecord: handlers.onExportSessionRecord,
        onOpenConsole: handlers.onOpenConsole,
        onMinimizeWindow: handlers.onMinimizeWindow,
        onToggleMaximizeWindow: handlers.onToggleMaximizeWindow,
        onCloseWindow: handlers.onCloseWindow,
        onCreateSourceSimulationPanel: handlers.onCreateSourceSimulationPanel,
        onRemoveSourceSimulationPanel: handlers.onRemoveSourceSimulationPanel,
        onUpdateSourceSimulationInput: handlers.onUpdateSourceSimulationInput,
        onUpdateSourceSimulationProfile: handlers.onUpdateSourceSimulationProfile,
        onUpdateSourceSimulationRequestField: handlers.onUpdateSourceSimulationRequestField,
        onSubmitSourceSimulationPanel: handlers.onSubmitSourceSimulationPanel,
        onStopInput: createStopInputHandler(),
    };
}

/**
 * 作用：构建 MagiRoot 组件上下文。
 * 意图：让 `MagiRoot.vue` 保持装配层角色，而上下文实现细节拆分到 `rootctx` 子目录。
 * 调用时机：`MagiRoot.vue` setup 阶段调用一次。
 */
/** @同步豁免: UI构建 — Vue setup 阶段必须同步返回可用上下文。 */
export function useMagiRootContext() {
    const state = createMagiRootState();
    const computedState = createMagiRootComputed(state);
    const handlers = createMagiRootHandlers(state);

    void bootstrapWorkspaceAIMainNotebookGuard(state);

    const context = {
        ...createCoreContext(state),
        ...createNotebookContext(state, computedState),
        ...createRuntimeViewContext(computedState),
        ...createHandlerContext(handlers),
    } satisfies MagiRootContext;

    return context;
}
