import { computed, ref } from "vue";
import { useMagi } from "../composables/useMagi";
import { appendConsensusMessage } from "../composables/useMagi.consensus";
import { exportMagiSessionRecord } from "../composables/useMagi.export";
import type { UseMagiReturn } from "../composables/useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import type { MagiRootContext } from "./MagiRoot.types";
import type { PersonaSeedSavedEvent } from "./persona-seed-panel/PersonaSeedPanel.types";
import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { Constants } from "../../constants";
import { loadPromptInjectionsByProfilePath } from "../prompts/personaRuntimePromptBuilder";

/** @同步豁免: 纯数据归一化，无异步依赖 */
/**
 * 作用：将 PersonaSeedPanel `saved` 事件统一归一化为路径对象。
 * 意图：兼容旧版仅传字符串 samplePath 的事件契约。
 * 调用时机：MagiRoot 接收 `saved` 事件后调用。
 */
function normalizeSavedPaths(
    saved: PersonaSeedSavedEvent,
): { readonly samplePath: string; readonly profilePath: string | null } {
    // 兼容旧版：仅传 samplePath 字符串
    if (typeof saved === "string") {
        return {
            samplePath: saved,
            profilePath: null,
        };
    }
    return {
        samplePath: saved.samplePath,
        profilePath: saved.profilePath?.trim() || null,
    };
}

/**
 * 处理输入栏提交事件
 *
 * 作用：转发用户输入到 `useMagi.sendUserMessage` 并在成功后清空输入框。
 * 意图：保持输入处理入口统一，避免组件模板直接耦合业务流程。
 * 调用时机：`MagiMainPanel` 触发 `submit-input` 事件时调用。
 */
async function handleSubmitInput(
    magiState: { value: UseMagiReturn | null },
    inputValue: { value: string },
    value: string,
): Promise<void> {
    if (!magiState.value) {
        return;
    }
    await magiState.value.sendUserMessage(value);
    inputValue.value = "";
}

/**
 * 处理问卷入口按钮事件
 *
 * 作用：在主消息流追加占位提示，标记问卷入口后续接入点。
 * 意图：保证按钮行为可见且不阻断主流程。
 * 调用时机：`MagiMainPanelHeader` 触发 `show-questionnaire` 事件时调用。
 */
async function handleShowQuestionnaire(
    showQuestionnairePanel: { value: boolean },
): Promise<void> {
    showQuestionnairePanel.value = true;
}

/**
 * 处理重连动作
 *
 * 作用：调用 `useMagi.initializeMAGI` 重建贤者连接与消息状态。
 * 意图：提供独立入口下的可恢复操作，避免刷新页面才能恢复。
 * 调用时机：MagiRoot 顶部 RECONNECT 按钮点击时调用。
 */
async function handleReconnect(
    magiState: { value: UseMagiReturn | null },
): Promise<void> {
    if (!magiState.value) {
        return;
    }
    await magiState.value.initializeMAGI();
}

/**
 * 导出 MAGI 会话详细记录（含决策链路）。
 */
async function handleExportSessionRecord(
    magiState: { value: UseMagiReturn | null },
): Promise<void> {
    if (!magiState.value) {
        return;
    }
    try {
        const { filePath } = await exportMagiSessionRecord({
            seels: magiState.value.seels,
            consensusMessages: magiState.value.consensusMessages,
            connectionStatus: magiState.value.connectionStatus.value,
            mode: "sanitized",
        });
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "system",
            `MAGI详细记录已导出: ${filePath}`,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "error",
            `MAGI详细记录导出失败: ${message}`,
        );
    }
}

/**
 * 创建输入提交事件处理器
 *
 * 作用：将组件事件参数转发到 `handleSubmitInput`。
 * 意图：在不使用函数内命名声明的前提下复用闭包上下文。
 * 调用时机：`useMagiRootContext` 返回事件处理器时调用。
 */
function createSubmitInputHandler(
    magiState: { value: UseMagiReturn | null },
    inputValue: { value: string },
): (value: string) => Promise<void> {
    return async (value: string) => handleSubmitInput(magiState, inputValue, value);
}

/**
 * 创建问卷按钮事件处理器
 *
 * 作用：将点击事件转发到 `handleShowQuestionnaire`。
 * 意图：保持模板事件入口统一，减少组件脚本分支。
 * 调用时机：`useMagiRootContext` 返回事件处理器时调用。
 */
function createShowQuestionnaireHandler(
    showQuestionnairePanel: { value: boolean },
): () => Promise<void> {
    return async () => handleShowQuestionnaire(showQuestionnairePanel);
}

/** 创建问卷面板关闭处理器 */
function createCloseQuestionnaireHandler(
    showQuestionnairePanel: { value: boolean },
): () => void {
    return () => {
        showQuestionnairePanel.value = false;
    };
}

/** 创建问卷保存成功处理器 */
function createQuestionnaireSavedHandler(
    magiState: { value: UseMagiReturn | null },
): (saved: PersonaSeedSavedEvent) => Promise<void> {
    return async (saved: PersonaSeedSavedEvent) => {
        if (!magiState.value) {
            return;
        }
        const savedPaths = normalizeSavedPaths(saved);
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "system",
            `人格采样问卷已保存: ${savedPaths.samplePath}`,
        );
        // 旧版事件不包含 profilePath 时保持兼容：仅提示保存成功，不触发重载。
        if (!savedPaths.profilePath) {
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "system",
                "未提供人格档案路径，已跳过人格重载。",
            );
            return;
        }
        try {
            const promptInjections = await loadPromptInjectionsByProfilePath(savedPaths.profilePath);
            // 人格档案读取或校验失败时保留当前运行态，不中断会话。
            if (!promptInjections) {
                await appendConsensusMessage(
                    magiState.value.consensusMessages,
                    "error",
                    `人格档案读取失败，继续使用当前配置: ${savedPaths.profilePath}`,
                );
                return;
            }
            await magiState.value.initializeMAGI({
                promptInjections,
                preserveConsensusMessages: true,
            });
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "system",
                `已加载人格档案并完成重建: ${savedPaths.profilePath}`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "error",
                `人格重载失败，继续使用当前配置: ${message}`,
            );
        }
    };
}

/**
 * 创建重连事件处理器
 *
 * 作用：将 UI 重连动作转发到 `handleReconnect`。
 * 意图：收敛重连入口，避免模板直接触达底层状态。
 * 调用时机：`useMagiRootContext` 返回事件处理器时调用。
 */
function createReconnectHandler(
    magiState: { value: UseMagiReturn | null },
): () => Promise<void> {
    return async () => handleReconnect(magiState);
}

/** 创建详细记录导出处理器 */
function createExportSessionRecordHandler(
    magiState: { value: UseMagiReturn | null },
): () => Promise<void> {
    return async () => handleExportSessionRecord(magiState);
}

/**
 * 创建控制台按钮事件处理器
 *
 * 作用：在 Electron 环境触发主进程打开 DevTools。
 * 意图：为 MAGI 独立窗口提供调试入口，并保持和主界面帮助菜单行为一致。
 * 调用时机：MagiRoot 标题栏控制台按钮点击时调用。
 */
function createOpenConsoleHandler(): () => Promise<void> {
    return async () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "openDevTools");
    };
}

/** 判断是否为 TRINITY 面板 */
function isTrinitySeel(name: string): boolean {
    return name === "TRINITY-00";
}

/**
 * 初始化 MAGI 运行时状态
 *
 * 作用：执行 `useMagi` 初始化并更新 ready/error 状态。
 * 意图：把启动时异步流程与错误处理集中到单一函数，降低模板复杂度。
 * 调用时机：`useMagiRootContext` 构造完成后立即调用一次。
 */
async function bootstrapMagiState(
    magiState: { value: UseMagiReturn | null },
    ready: { value: boolean },
    bootError: { value: string | null },
): Promise<void> {
    try {
        magiState.value = await useMagi();
        ready.value = true;
    } catch (error) {
        bootError.value = error instanceof Error ? error.message : String(error);
    }
}

/** @同步豁免: UI构建 — setup 阶段需同步初始化响应式状态容器 */
/**
 * 作用：创建 MagiRoot 基础响应式状态。
 * 意图：将状态创建从主 composable 中拆分，降低函数体积。
 * 调用时机：`useMagiRootContext` 调用开始时。
 */
function createMagiRootState() {
    return {
        ready: ref(false),
        bootError: ref<string | null>(null),
        inputValue: ref(""),
        showMessages: ref(true),
        showSeels: ref(true),
        showTrinity: ref(false),
        showQuestionnairePanel: ref(false),
        magiState: ref<UseMagiReturn | null>(null),
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回计算属性 */
/**
 * 作用：创建 MagiRoot 视图层计算属性。
 * 意图：将计算属性装配逻辑从主 composable 中拆分，控制函数复杂度。
 * 调用时机：`useMagiRootContext` 内部调用。
 */
function createMagiRootComputed(
    magiState: { value: UseMagiReturn | null },
    showMessages: { value: boolean },
) {
    const seels = computed(() => magiState.value?.seels ?? []);
    const consensusMessages = computed(() => magiState.value?.consensusMessages ?? []);
    const sageSeels = computed(() =>
        seels.value.filter((seel) => !isTrinitySeel(seel.config.name)),
    );
    const trinitySeel = computed(
        () => seels.value.find((seel) => isTrinitySeel(seel.config.name)) ?? null,
    );
    const isAnySeelLoading = computed(
        () => magiState.value?.isAnySeelLoading.value ?? false,
    );
    const displayMessages = computed<MagiMessage[]>(
        () => (showMessages.value ? consensusMessages.value : []),
    );
    return { seels, sageSeels, trinitySeel, isAnySeelLoading, displayMessages };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/**
 * 作用：创建 MagiRoot 事件处理器集合。
 * 意图：将 handler 装配逻辑从主 composable 中拆分，降低主函数行数。
 * 调用时机：`useMagiRootContext` 内部调用。
 */
function createMagiRootHandlers(
    magiState: { value: UseMagiReturn | null },
    inputValue: { value: string },
    showQuestionnairePanel: { value: boolean },
) {
    return {
        onSubmitInput: createSubmitInputHandler(magiState, inputValue),
        onShowQuestionnaire: createShowQuestionnaireHandler(showQuestionnairePanel),
        onCloseQuestionnaire: createCloseQuestionnaireHandler(showQuestionnairePanel),
        onQuestionnaireSaved: createQuestionnaireSavedHandler(magiState),
        onReconnect: createReconnectHandler(magiState),
        onExportSessionRecord: createExportSessionRecordHandler(magiState),
        onOpenConsole: createOpenConsoleHandler(),
    };
}

/** @同步豁免: UI构建 — 事件占位符需同步提供给模板绑定 */
function createStopInputHandler(): () => void {
    return () => {
        // no-op
    };
}

/**
 * 构建 MagiRoot 组件上下文
 *
 * 作用：集中创建响应式状态、计算属性和 UI 事件处理函数。
 * 意图：满足 Fat Script 约束，让 `.vue` 文件仅保留装配层代码。
 * 调用时机：`MagiRoot.vue` setup 阶段调用一次。
 */
/** @同步豁免: UI构建 — Vue setup 必须同步返回可用上下文 */
export function useMagiRootContext(): MagiRootContext {
    const state = createMagiRootState();
    const computedState = createMagiRootComputed(state.magiState, state.showMessages);
    const handlers = createMagiRootHandlers(
        state.magiState,
        state.inputValue,
        state.showQuestionnairePanel,
    );

    void bootstrapMagiState(state.magiState, state.ready, state.bootError);

    const ctx: MagiRootContext = {
        ready: state.ready,
        bootError: state.bootError,
        inputValue: state.inputValue,
        showMessages: state.showMessages,
        showSeels: state.showSeels,
        showTrinity: state.showTrinity,
        showQuestionnairePanel: state.showQuestionnairePanel,
        seels: computedState.seels,
        sageSeels: computedState.sageSeels,
        trinitySeel: computedState.trinitySeel,
        displayMessages: computedState.displayMessages,
        isAnySeelLoading: computedState.isAnySeelLoading,
        onSubmitInput: handlers.onSubmitInput,
        onShowQuestionnaire: handlers.onShowQuestionnaire,
        onCloseQuestionnaire: handlers.onCloseQuestionnaire,
        onQuestionnaireSaved: handlers.onQuestionnaireSaved,
        onReconnect: handlers.onReconnect,
        onExportSessionRecord: handlers.onExportSessionRecord,
        onOpenConsole: handlers.onOpenConsole,
        onStopInput: createStopInputHandler(),
        magiState: state.magiState,
    };
    return ctx;
}
