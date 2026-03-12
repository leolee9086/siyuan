import { computed, ref } from "vue";
import { useMagi } from "../composables/useMagi";
import { appendConsensusMessage } from "../composables/useMagi.consensus";
import { exportMagiSessionRecord } from "../composables/useMagi.export";
import type {
    SourceSimulationContext,
    UseMagiReturn,
    WrappedSeel,
} from "../composables/useMagi.types";
import { loginMagiIdentity, type MagiRequestChannel } from "../service/magiIdentitySession";
import type {
    MagiMainPanelMessageView,
    MagiMainPanelSeelView,
    MagiSeelPanelView,
} from "./magiView.types";
import type {
    MagiRootContext,
    SourceSimulationPanelMessageView,
    SourceSimulationPanelView,
    SourceSimulationProfileView,
} from "./MagiRoot.types";
import { isElectron, isMobile } from "../../platform";
import { ipcSend, ipcInvoke } from "../../platform/electron/ipcRenderer";
import { Constants } from "../../constants";
import { createQuestionnaireSavedHandler } from "../composables/root/MagiRoot.questionnaire";

const DEFAULT_SOURCE_SIMULATION_PROFILES: SourceSimulationProfileView[] = [
    {
        id: "guardian-trusted",
        label: "Guardian Trusted",
        source: "guardian",
        trustBase: "high",
        riskLevel: "low",
        callerId: "guardian-main",
    },
    {
        id: "external-neutral",
        label: "External Neutral",
        source: "external-agent",
        trustBase: "medium",
        riskLevel: "medium",
        callerId: "external-neutral",
    },
    {
        id: "external-untrusted",
        label: "External Untrusted",
        source: "external-agent",
        trustBase: "low",
        riskLevel: "high",
        callerId: "external-untrusted",
    },
    {
        id: "unknown-probe",
        label: "Unknown Probe",
        source: "unknown",
        trustBase: "low",
        riskLevel: "high",
        callerId: "unknown-probe",
    },
];

function createSourceSimulationProfileOptions(): SourceSimulationProfileView[] {
    return DEFAULT_SOURCE_SIMULATION_PROFILES.map((profile) => ({ ...profile }));
}

function createSourcePanelId(): string {
    return `source-panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSourcePanelMessage(
    role: SourceSimulationPanelMessageView["role"],
    content: string,
    status: SourceSimulationPanelMessageView["status"],
): SourceSimulationPanelMessageView {
    return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        timestamp: Date.now(),
        status,
    };
}

function createSourcePanelTitle(index: number): string {
    return `SOURCE-${String(index).padStart(2, "0")}`;
}

function resolveSourceMessageChannel(
    source: SourceSimulationProfileView["source"],
): "guardian" | "external-agent" | "system-cron" | "unknown" {
    if (source === "guardian" || source === "external-agent" || source === "system-cron") {
        return source;
    }
    return "unknown";
}

function createSourceSimulationPanel(
    index: number,
    profileId: string,
): SourceSimulationPanelView {
    return {
        id: createSourcePanelId(),
        title: createSourcePanelTitle(index),
        selectedProfileId: profileId,
        identityId: "",
        password: "",
        nickname: "",
        channel: "tool-custom",
        requestModel: "magi-default",
        inputValue: "",
        loading: false,
        messages: [
            createSourcePanelMessage(
                "system",
                "Source simulation panel ready. Select profile and send request.",
                "success",
            ),
        ],
    };
}

function buildSourceSimulationContext(
    profile: SourceSimulationProfileView,
    panel: SourceSimulationPanelView,
): SourceSimulationContext {
    return {
        requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        callerId: `${profile.callerId}:${panel.id}`,
        source: profile.source,
        trustBase: profile.trustBase,
        riskLevel: profile.riskLevel,
        profileId: profile.id,
        profileLabel: profile.label,
        sourceChannel: resolveSourceMessageChannel(profile.source),
        sourcePanelId: panel.id,
        sourcePanelTitle: panel.title,
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
    try {
        await magiState.value.sendUserMessage(value);
        inputValue.value = "";
    } catch (error) {
        const rawMessage = error instanceof Error ? error.message : String(error);
        const isIdentityMissing = rawMessage.toLowerCase().includes("identity session missing");
        const message = isIdentityMissing
            ? "MAGI 身份会话缺失，请在 Identity Access Control 面板登录后重试。"
            : `请求失败: ${rawMessage}`;
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "error",
            message,
        );
    }
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

function findSourcePanel(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    panelId: string,
): SourceSimulationPanelView | null {
    return sourceSimulationPanels.value.find((panel) => panel.id === panelId) ?? null;
}

function findSourceProfile(
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
    profileId: string,
): SourceSimulationProfileView | null {
    return sourceSimulationProfiles.value.find((profile) => profile.id === profileId) ?? null;
}

function handleCreateSourceSimulationPanel(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
): void {
    const defaultProfileId = sourceSimulationProfiles.value[0]?.id ?? "unknown-probe";
    const nextIndex = sourceSimulationPanels.value.length + 1;
    sourceSimulationPanels.value.push(
        createSourceSimulationPanel(nextIndex, defaultProfileId),
    );
}

function handleRemoveSourceSimulationPanel(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    panelId: string,
): void {
    const nextPanels = sourceSimulationPanels.value.filter((panel) => panel.id !== panelId);
    sourceSimulationPanels.value = nextPanels;
}

function handleUpdateSourceSimulationInput(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    panelId: string,
    value: string,
): void {
    const panel = findSourcePanel(sourceSimulationPanels, panelId);
    if (!panel) {
        return;
    }
    panel.inputValue = value;
}

function handleUpdateSourceSimulationProfile(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
    panelId: string,
    profileId: string,
): void {
    const panel = findSourcePanel(sourceSimulationPanels, panelId);
    if (!panel) {
        return;
    }
    const profile = findSourceProfile(sourceSimulationProfiles, profileId);
    if (!profile) {
        return;
    }
    panel.selectedProfileId = profile.id;
}

function handleUpdateSourceSimulationRequestField(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    panelId: string,
    field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
    value: string,
): void {
    const panel = findSourcePanel(sourceSimulationPanels, panelId);
    if (!panel) {
        return;
    }
    if (field === "channel") {
        panel.channel = value as SourceSimulationPanelView["channel"];
        return;
    }
    panel[field] = value;
}

function buildSourceSimulationIdentityMirror(
    panel: SourceSimulationPanelView,
    identityId: string,
    requestId: string,
): string {
    const kind = panel.channel === "magi-main-ui" ? "magi-main-ui" : panel.channel;
    return JSON.stringify({
        principal: identityId,
        interface: panel.id,
        kind,
        conversation: requestId,
    });
}

async function sendSourceSimulationRequest(
    armorToken: string,
    body: Record<string, unknown>,
): Promise<string> {
    const response = await fetch("/api/s-forge/magi/v1/chat/completions", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${armorToken}`,
        },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorText = typeof payload === "object" && payload !== null
            ? String(Reflect.get(payload, "error") ?? Reflect.get(payload, "msg") ?? `HTTP ${response.status}`)
            : `HTTP ${response.status}`;
        throw new Error(errorText);
    }
    const choices = typeof payload === "object" && payload !== null
        ? Reflect.get(payload, "choices")
        : null;
    if (!Array.isArray(choices) || choices.length === 0) {
        return "";
    }
    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== "object") {
        return "";
    }
    const message = Reflect.get(firstChoice, "message");
    if (!message || typeof message !== "object") {
        return "";
    }
    return String(Reflect.get(message, "content") ?? "").trim();
}

async function handleSubmitSourceSimulationPanel(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
    panelId: string,
): Promise<void> {
    const panel = findSourcePanel(sourceSimulationPanels, panelId);
    if (!panel || panel.loading) {
        return;
    }
    const rawInput = panel.inputValue.trim();
    if (!rawInput) {
        return;
    }
    const profile = findSourceProfile(sourceSimulationProfiles, panel.selectedProfileId);
    if (!profile) {
        panel.messages.push(createSourcePanelMessage("error", "Invalid source profile.", "error"));
        return;
    }
    const sourceContext = buildSourceSimulationContext(profile, panel);
    const identityId = panel.identityId.trim();
    const password = panel.password.trim();
    const nickname = panel.nickname.trim() || identityId;
    const modelName = panel.requestModel.trim() || "magi-default";
    const requestChannel = panel.channel as MagiRequestChannel;

    if (!identityId || !password) {
        panel.messages.push(createSourcePanelMessage("error", "identity/password required for simulation.", "error"));
        return;
    }
    panel.messages.push(createSourcePanelMessage("user", rawInput, "success"));
    const pendingAssistant = createSourcePanelMessage("assistant", "Waiting response...", "pending");
    panel.messages.push(pendingAssistant);
    panel.loading = true;
    panel.inputValue = "";
    try {
        const loginSession = await loginMagiIdentity({
            identityId,
            password,
            nickname,
            channel: requestChannel,
            activate: false,
        });
        const sourcePayload = `<magi_request_source>${JSON.stringify(sourceContext)}</magi_request_source>`;
        const mirrorUser = buildSourceSimulationIdentityMirror(panel, loginSession.identityId, sourceContext.requestId);
        const reply = await sendSourceSimulationRequest(loginSession.armorToken, {
            model: modelName,
            stream: false,
            user: mirrorUser,
            messages: [
                { role: "system", content: sourcePayload },
                { role: "user", content: rawInput },
            ],
        });
        pendingAssistant.content = reply || "[empty response]";
        pendingAssistant.status = "success";
        pendingAssistant.timestamp = Date.now();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pendingAssistant.content = message;
        pendingAssistant.status = "error";
        pendingAssistant.role = "error";
        pendingAssistant.timestamp = Date.now();
    } finally {
        panel.loading = false;
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

function createSourceSimulationPanelCreateHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
): () => void {
    return () => {
        handleCreateSourceSimulationPanel(sourceSimulationPanels, sourceSimulationProfiles);
    };
}

function createSourceSimulationPanelRemoveHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
): (panelId: string) => void {
    return (panelId: string) => {
        handleRemoveSourceSimulationPanel(sourceSimulationPanels, panelId);
    };
}

function createSourceSimulationInputUpdateHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
): (panelId: string, value: string) => void {
    return (panelId: string, value: string) => {
        handleUpdateSourceSimulationInput(sourceSimulationPanels, panelId, value);
    };
}

function createSourceSimulationProfileUpdateHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
): (panelId: string, profileId: string) => void {
    return (panelId: string, profileId: string) => {
        handleUpdateSourceSimulationProfile(
            sourceSimulationPanels,
            sourceSimulationProfiles,
            panelId,
            profileId,
        );
    };
}

function createSourceSimulationRequestFieldUpdateHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
): (
    panelId: string,
    field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
    value: string,
) => void {
    return (
        panelId: string,
        field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
        value: string,
    ) => {
        handleUpdateSourceSimulationRequestField(sourceSimulationPanels, panelId, field, value);
    };
}

function createSourceSimulationSubmitHandler(
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
): (panelId: string) => Promise<void> {
    return async (panelId: string) => {
        await handleSubmitSourceSimulationPanel(
            sourceSimulationPanels,
            sourceSimulationProfiles,
            panelId,
        );
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
function createOpenConsoleHandler(): () => Promise<void> {
    return async () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "openDevTools");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
function createMinimizeWindowHandler(): () => void {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "minimize");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
function createToggleMaximizeWindowHandler(): () => Promise<void> {
    return async () => {
        if (!isElectron) {
            return;
        }
        const isMaximized = await ipcInvoke<boolean>(Constants.SIYUAN_GET, {
            cmd: "isMaximized",
        });
        ipcSend(Constants.SIYUAN_CMD, isMaximized ? "restore" : "maximize");
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
function createCloseWindowHandler(): () => void {
    return () => {
        if (!isElectron) {
            return;
        }
        ipcSend(Constants.SIYUAN_CMD, "closeButtonBehavior");
    };
}

/** 判断是否为 TRINITY 面板 */
function isTrinitySeel(name: string): boolean {
    return name === "TRINITY-00";
}

/** 将运行时贤者包装对象映射为 UI 专用 SeelPanel 视图 */
function mapWrappedSeelToPanelView(seel: WrappedSeel): MagiSeelPanelView {
    return {
        config: {
            name: seel.config.name,
            displayName: seel.config.displayName,
            color: seel.config.color,
            icon: seel.config.icon,
            persona: seel.config.persona,
            responseType: seel.config.responseType,
            memorySize: seel.config.memorySize,
        },
        messages: seel.messages.map((message) => ({
            id: message.id,
            type: message.type,
            content: message.content,
            status: message.status,
            timestamp: message.timestamp,
            ...(message.meta ? { meta: message.meta } : {}),
        })),
        loading: seel.loading,
        connected: seel.connected,
    };
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
    const sourceSimulationProfiles = ref<SourceSimulationProfileView[]>(
        createSourceSimulationProfileOptions(),
    );
    const sourceSimulationPanels = ref<SourceSimulationPanelView[]>([]);
    handleCreateSourceSimulationPanel(sourceSimulationPanels, sourceSimulationProfiles);
    return {
        ready: ref(false),
        bootError: ref<string | null>(null),
        inputValue: ref(""),
        showMessages: ref(true),
        showSeels: ref(true),
        showTrinity: ref(true),
        showQuestionnairePanel: ref(false),
        sourceSimulationProfiles,
        sourceSimulationPanels,
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
    showSeels: { value: boolean },
) {
    const seels = computed(() => magiState.value?.seels ?? []);
    const mainPanelSeels = computed<MagiMainPanelSeelView[]>(() =>
        seels.value.map((seel) => ({
            config: {
                name: seel.config.name,
                displayName: seel.config.displayName,
            },
            loading: seel.loading,
            connected: seel.connected,
        })),
    );
    const consensusMessages = computed(() => magiState.value?.consensusMessages ?? []);
    const sageSeels = computed(() =>
        seels.value.filter((seel) => !isTrinitySeel(seel.config.name)),
    );
    const sageSeelViews = computed<MagiSeelPanelView[]>(() =>
        sageSeels.value.map((seel) => mapWrappedSeelToPanelView(seel)),
    );
    const trinitySeel = computed(
        () => seels.value.find((seel) => isTrinitySeel(seel.config.name)) ?? null,
    );
    const trinitySeelView = computed<MagiSeelPanelView | null>(() =>
        trinitySeel.value ? mapWrappedSeelToPanelView(trinitySeel.value) : null,
    );
    const isAnySeelLoading = computed(
        () => magiState.value?.isAnySeelLoading.value ?? false,
    );
    const displayMessages = computed<MagiMainPanelMessageView[]>(() => !showMessages.value
        ? []
        : showSeels.value
            ? consensusMessages.value.filter((message) => !(message.type === "consensus" && Reflect.get(message.meta ?? {}, "type") === "sage-response"))
            : consensusMessages.value);
    return {
        seels,
        mainPanelSeels,
        sageSeels,
        trinitySeel,
        sageSeelViews,
        trinitySeelView,
        isAnySeelLoading,
        displayMessages,
    };
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
    sourceSimulationPanels: { value: SourceSimulationPanelView[] },
    sourceSimulationProfiles: { value: SourceSimulationProfileView[] },
) {
    return {
        onSubmitInput: createSubmitInputHandler(magiState, inputValue),
        onShowQuestionnaire: createShowQuestionnaireHandler(showQuestionnairePanel),
        onCloseQuestionnaire: createCloseQuestionnaireHandler(showQuestionnairePanel),
        onQuestionnaireSaved: createQuestionnaireSavedHandler(magiState),
        onReconnect: createReconnectHandler(magiState),
        onExportSessionRecord: createExportSessionRecordHandler(magiState),
        onOpenConsole: createOpenConsoleHandler(),
        onMinimizeWindow: createMinimizeWindowHandler(),
        onToggleMaximizeWindow: createToggleMaximizeWindowHandler(),
        onCloseWindow: createCloseWindowHandler(),
        onCreateSourceSimulationPanel: createSourceSimulationPanelCreateHandler(
            sourceSimulationPanels,
            sourceSimulationProfiles,
        ),
        onRemoveSourceSimulationPanel: createSourceSimulationPanelRemoveHandler(
            sourceSimulationPanels,
        ),
        onUpdateSourceSimulationInput: createSourceSimulationInputUpdateHandler(
            sourceSimulationPanels,
        ),
        onUpdateSourceSimulationProfile: createSourceSimulationProfileUpdateHandler(
            sourceSimulationPanels,
            sourceSimulationProfiles,
        ),
        onUpdateSourceSimulationRequestField: createSourceSimulationRequestFieldUpdateHandler(
            sourceSimulationPanels,
        ),
        onSubmitSourceSimulationPanel: createSourceSimulationSubmitHandler(
            sourceSimulationPanels,
            sourceSimulationProfiles,
        ),
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
    const computedState = createMagiRootComputed(state.magiState, state.showMessages, state.showSeels);
    const handlers = createMagiRootHandlers(
        state.magiState,
        state.inputValue,
        state.showQuestionnairePanel,
        state.sourceSimulationPanels,
        state.sourceSimulationProfiles,
    );

    void bootstrapMagiState(state.magiState, state.ready, state.bootError);

    return {
        ready: state.ready,
        bootError: state.bootError,
        inputValue: state.inputValue,
        showMessages: state.showMessages,
        showSeels: state.showSeels,
        showTrinity: state.showTrinity,
        showQuestionnairePanel: state.showQuestionnairePanel,
        sourceSimulationProfiles: state.sourceSimulationProfiles,
        sourceSimulationPanels: state.sourceSimulationPanels,
        seels: computedState.seels,
        mainPanelSeels: computedState.mainPanelSeels,
        sageSeels: computedState.sageSeels,
        trinitySeel: computedState.trinitySeel,
        sageSeelViews: computedState.sageSeelViews,
        trinitySeelView: computedState.trinitySeelView,
        displayMessages: computedState.displayMessages,
        isAnySeelLoading: computedState.isAnySeelLoading,
        showWindowControls: computed(() => isElectron && !isMobile),
        onSubmitInput: handlers.onSubmitInput,
        onShowQuestionnaire: handlers.onShowQuestionnaire,
        onCloseQuestionnaire: handlers.onCloseQuestionnaire,
        onQuestionnaireSaved: handlers.onQuestionnaireSaved,
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
        magiState: state.magiState,
    };
}
