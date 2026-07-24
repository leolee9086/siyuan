/** 用途：标注来源模拟面板消息结构；使用范围：来源模拟欢迎消息和面板消息构造；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelMessageView } from "./imports";
/** 用途：标注来源模拟面板结构；使用范围：来源模拟状态与 handler 参数；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelView } from "./imports";
/** 用途：标注来源模拟画像结构；使用范围：默认画像配置与选择逻辑；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationProfileView } from "./imports";
/** 用途：标注来源模拟所需最小状态；使用范围：来源模拟查询和更新操作；解耦评估：通过 imports.ts 注入结构契约，不反向依赖状态工厂。 */
import type { SourceSimulationStatePort } from "./imports";

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

/**
 * 作用：为 rootctx 初始化生成来源模拟画像副本。
 * 意图：避免不同面板共享同一份默认画像对象，导致后续修改时互相污染。
 * 调用时机：`createMagiRootState` 初始化时调用。
 */
/** @同步豁免: UI构建 — 初始化面板状态时需要同步生成默认画像副本。 */
export function createSourceSimulationProfileOptions() {
    const profiles: SourceSimulationProfileView[] = [];
    for (const profile of DEFAULT_SOURCE_SIMULATION_PROFILES) {
        profiles.push({ ...profile });
    }
    return profiles;
}

/**
 * 作用：创建来源模拟面板唯一 ID。
 * 意图：保证每个模拟面板的请求上下文和 DOM 绑定标识稳定唯一。
 * 调用时机：创建来源模拟面板时调用。
 */
function createSourcePanelId() {
    return `source-panel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 作用：创建来源模拟面板消息对象。
 * 意图：统一消息 ID、时间戳和状态字段的生成方式。
 * 调用时机：初始化面板欢迎消息时调用。
 */
function createSourcePanelMessage(
    role: SourceSimulationPanelMessageView["role"],
    content: string,
    status: SourceSimulationPanelMessageView["status"],
) {
    return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        timestamp: Date.now(),
        status,
    };
}

/**
 * 作用：为来源模拟面板生成展示标题。
 * 意图：让多个 panel 在 UI 中保持固定序号风格。
 * 调用时机：创建来源模拟面板时调用。
 */
function createSourcePanelTitle(index: number) {
    return `SOURCE-${String(index).padStart(2, "0")}`;
}

/**
 * 作用：创建单个来源模拟面板初始状态。
 * 意图：把默认输入项和欢迎消息集中在一处维护。
 * 调用时机：初始化默认面板或新增面板时调用。
 */
function createSourceSimulationPanel(index: number, profileId: string) {
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

/**
 * 作用：为 rootctx 初始化生成默认来源模拟面板。
 * 意图：保证页面首次进入时已有一块可直接操作的来源模拟区域。
 * 调用时机：`createMagiRootState` 初始化时调用。
 */
/** @同步豁免: UI构建 — 初始化面板状态时需要同步创建默认来源模拟面板。 */
export function createDefaultSourceSimulationPanels(
    profiles: readonly SourceSimulationProfileView[],
) {
    const defaultProfile = profiles[0];
    const defaultProfileId = defaultProfile ? defaultProfile.id : "unknown-probe";
    return [createSourceSimulationPanel(1, defaultProfileId)];
}

/**
 * 作用：从 rootctx 中按 ID 查找来源模拟面板。
 * 意图：收敛各 handler 的面板定位逻辑。
 * 调用时机：所有按 panelId 更新状态的来源模拟动作中调用。
 */
function findSourcePanel(
    state: SourceSimulationStatePort,
    panelId: string,
) {
    return state.sourceSimulationPanels.value.find((panel) => panel.id === panelId) ?? null;
}

/**
 * 作用：从 rootctx 中按 ID 查找来源模拟画像。
 * 意图：保证画像切换只写回当前仍然存在的画像配置。
 * 调用时机：来源模拟画像切换时调用。
 */
function findSourceProfile(
    state: SourceSimulationStatePort,
    profileId: string,
) {
    return state.sourceSimulationProfiles.value.find((profile) => profile.id === profileId) ?? null;
}

/**
 * 作用：把字符串解析为合法来源模拟信道。
 * 意图：在字段更新阶段过滤非法 channel 值，避免脏数据写入状态。
 * 调用时机：更新来源模拟请求字段时调用。
 */
function resolveSourceSimulationChannelValue(value: string) {
    if (value === "magi-main-ui") {
        return value;
    }
    if (value === "tool-claude-code") {
        return value;
    }
    if (value === "tool-openai-sdk") {
        return value;
    }
    if (value === "tool-claude-sdk") {
        return value;
    }
    if (value === "tool-custom") {
        return value;
    }
    if (value === "system-cron") {
        return value;
    }
    return null;
}

/**
 * 作用：把来源模拟字段变更写回面板状态。
 * 意图：集中处理 channel 校验，避免模板层分支膨胀。
 * 调用时机：来源模拟身份/信道/模型字段变化时调用。
 */
function updateSourceSimulationRequestField(
    panel: SourceSimulationPanelView,
    field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
    value: string,
) {
    // 输入的是 identityId 字段时，只更新身份标识本身。
    if (field === "identityId") {
        panel.identityId = value;
        return;
    }
    // 输入的是 password 字段时，只更新认证口令。
    if (field === "password") {
        panel.password = value;
        return;
    }
    // 输入的是 nickname 字段时，只更新显示昵称。
    if (field === "nickname") {
        panel.nickname = value;
        return;
    }
    // 输入的是 requestModel 字段时，只更新模型名。
    if (field === "requestModel") {
        panel.requestModel = value;
        return;
    }
    const channelValue = resolveSourceSimulationChannelValue(value);
    // 只有当字符串能解析为受支持的 channel 时，才覆盖当前请求信道。
    if (channelValue) {
        panel.channel = channelValue;
    }
}

/**
 * 作用：处理新增来源模拟面板动作。
 * 意图：让新增面板逻辑只关注 state 变化，不暴露到入口层。
 * 调用时机：点击新增来源模拟面板按钮时调用。
 */
/** @同步豁免: UI构建 — 来源模拟面板新增属于同步状态变更。 */
export function handleCreateSourceSimulationPanel(
    state: SourceSimulationStatePort,
) {
    const defaultProfile = state.sourceSimulationProfiles.value[0];
    const defaultProfileId = defaultProfile ? defaultProfile.id : "unknown-probe";
    const nextIndex = state.sourceSimulationPanels.value.length + 1;
    state.sourceSimulationPanels.value.push(
        createSourceSimulationPanel(nextIndex, defaultProfileId),
    );
}

/**
 * 作用：处理删除来源模拟面板动作。
 * 意图：把面板列表重建逻辑集中到单一位置维护。
 * 调用时机：点击来源模拟面板关闭按钮时调用。
 */
/** @同步豁免: UI构建 — 来源模拟面板删除属于同步状态变更。 */
export function handleRemoveSourceSimulationPanel(
    state: SourceSimulationStatePort,
    panelId: string,
) {
    state.sourceSimulationPanels.value = state.sourceSimulationPanels.value.filter(
        (panel) => panel.id !== panelId,
    );
}

/**
 * 作用：更新来源模拟输入框内容。
 * 意图：让 UI 输入变化只通过 handler 改写状态，避免模板直接写复杂逻辑。
 * 调用时机：来源模拟面板输入框更新时调用。
 */
/** @同步豁免: UI构建 — 输入框内容更新属于同步状态变更。 */
export function handleUpdateSourceSimulationInput(
    state: SourceSimulationStatePort,
    panelId: string,
    value: string,
) {
    const panel = findSourcePanel(state, panelId);
    if (!panel) {
        return;
    }
    panel.inputValue = value;
}

/**
 * 作用：更新来源模拟画像选择。
 * 意图：保证只有存在的画像 ID 才会写回面板状态。
 * 调用时机：来源模拟画像下拉框变化时调用。
 */
/** @同步豁免: UI构建 — 画像切换属于同步状态变更。 */
export function handleUpdateSourceSimulationProfile(
    state: SourceSimulationStatePort,
    panelId: string,
    profileId: string,
) {
    const panel = findSourcePanel(state, panelId);
    if (!panel) {
        return;
    }
    const profile = findSourceProfile(state, profileId);
    if (!profile) {
        return;
    }
    panel.selectedProfileId = profile.id;
}

/**
 * 作用：更新来源模拟请求字段。
 * 意图：把请求字段写回逻辑集中管理，避免模板层分支膨胀。
 * 调用时机：来源模拟身份/信道/模型字段变化时调用。
 */
/** @同步豁免: UI构建 — 请求字段更新属于同步状态变更。 */
export function handleUpdateSourceSimulationRequestField(
    state: SourceSimulationStatePort,
    panelId: string,
    field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
    value: string,
) {
    const panel = findSourcePanel(state, panelId);
    if (!panel) {
        return;
    }
    updateSourceSimulationRequestField(panel, field, value);
}
