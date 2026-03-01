import { computed, ref } from "vue";
import { useMagi } from "../composables/useMagi";
import { appendConsensusMessage } from "../composables/useMagi.consensus";
import type { UseMagiReturn } from "../composables/useMagi.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import type { MagiRootContext } from "./MagiRoot.types";
import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { Constants } from "../../constants";

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
): (filePath: string) => Promise<void> {
    return async (filePath: string) => {
        if (!magiState.value) {
            return;
        }
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "system",
            `人格采样问卷已保存: ${filePath}`,
        );
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

/**
 * 构建 MagiRoot 组件上下文
 *
 * 作用：集中创建响应式状态、计算属性和 UI 事件处理函数。
 * 意图：满足 Fat Script 约束，让 `.vue` 文件仅保留装配层代码。
 * 调用时机：`MagiRoot.vue` setup 阶段调用一次。
 */
export function useMagiRootContext(): MagiRootContext {
    const ready = ref(false);
    const bootError = ref<string | null>(null);
    const inputValue = ref("");
    const showMessages = ref(true);
    const showSeels = ref(true);
    const showTrinity = ref(false);
    const showQuestionnairePanel = ref(false);
    const magiState = ref<UseMagiReturn | null>(null);

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

    const onSubmitInput = createSubmitInputHandler(magiState, inputValue);
    const onShowQuestionnaire = createShowQuestionnaireHandler(showQuestionnairePanel);
    const onCloseQuestionnaire = createCloseQuestionnaireHandler(showQuestionnairePanel);
    const onQuestionnaireSaved = createQuestionnaireSavedHandler(magiState);
    const onReconnect = createReconnectHandler(magiState);
    const onOpenConsole = createOpenConsoleHandler();

    void bootstrapMagiState(magiState, ready, bootError);

    const ctx: MagiRootContext = {
        ready,
        bootError,
        inputValue,
        showMessages,
        showSeels,
        showTrinity,
        showQuestionnairePanel,
        seels,
        sageSeels,
        trinitySeel,
        displayMessages,
        isAnySeelLoading,
        onSubmitInput,
        onShowQuestionnaire,
        onCloseQuestionnaire,
        onQuestionnaireSaved,
        onReconnect,
        onOpenConsole,
        /**
         * 作用：预留停止响应入口。
         * 意图：后续接入统一请求中断控制器时无需修改组件接口。
         * 调用时机：MagiMainPanel 输入栏触发 `stop-input` 事件时调用。
         */
        onStopInput: () => {
            // no-op
        },
        magiState,
    };
    return ctx;
}
