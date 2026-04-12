/** 用途：登录来源模拟身份；使用范围：source simulation 提交前获取 armor token；解耦评估：service 能力已通过 imports.ts 收口，当前依赖边界清晰。 */
import { loginMagiIdentity } from "./imports";
/** 用途：标注来源模拟请求上下文；使用范围：来源模拟请求源信息构造；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationContext } from "./imports";
/** 用途：标注来源模拟面板消息结构；使用范围：来源模拟提交过程中的消息写回；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelMessageView } from "./imports";
/** 用途：标注来源模拟面板结构；使用范围：来源模拟提交流程状态更新；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationPanelView } from "./imports";
/** 用途：标注来源模拟画像结构；使用范围：来源模拟请求上下文构造；解耦评估：纯类型依赖，通过 imports.ts 转发即可。 */
import type { SourceSimulationProfileView } from "./imports";
/** 用途：标注 rootctx 状态工厂；使用范围：提交模块通过 ReturnType 推导完整状态结构；解耦评估：纯类型依赖，直接依赖同目录状态模块合理。 */
import type { createMagiRootState } from "./MagiRoot.state";

/**
 * 作用：创建来源模拟面板消息对象。
 * 意图：统一提交流程里的消息 ID、时间戳和状态字段生成方式。
 * 调用时机：来源模拟提交前后写回用户/助手/错误消息时调用。
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
 * 作用：把画像 source 映射为请求源通道。
 * 意图：确保请求载荷只写入后端认可的 sourceChannel 字面量。
 * 调用时机：构造来源模拟请求上下文时调用。
 */
function resolveSourceMessageChannel(source: SourceSimulationProfileView["source"]) {
    if (source === "guardian") {
        return source;
    }
    if (source === "external-agent") {
        return source;
    }
    if (source === "system-cron") {
        return source;
    }
    return "unknown";
}

/**
 * 作用：从 rootctx 中按 ID 查找来源模拟面板。
 * 意图：让提交流程与其余来源模拟更新逻辑共享同一套面板定位方式。
 * 调用时机：提交来源模拟请求前调用。
 */
function findSourcePanel(
    state: ReturnType<typeof createMagiRootState>,
    panelId: string,
) {
    return state.sourceSimulationPanels.value.find((panel) => panel.id === panelId) ?? null;
}

/**
 * 作用：从 rootctx 中按 ID 查找来源模拟画像。
 * 意图：保证提交流程读取到的是当前最新画像配置。
 * 调用时机：提交来源模拟请求前调用。
 */
function findSourceProfile(
    state: ReturnType<typeof createMagiRootState>,
    profileId: string,
) {
    return state.sourceSimulationProfiles.value.find((profile) => profile.id === profileId) ?? null;
}

/**
 * 作用：把当前画像和面板信息组装成后端来源模拟上下文。
 * 意图：让后端能准确识别请求来源、风险等级和面板标识。
 * 调用时机：提交来源模拟请求前调用。
 */
function buildSourceSimulationContext(
    profile: SourceSimulationProfileView,
    panel: SourceSimulationPanelView,
) {
    const context: SourceSimulationContext = {
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
    return context;
}

/**
 * 作用：把身份会话信息镜像为 user 字段。
 * 意图：让来源模拟请求在后端能按面板和会话维度区分。
 * 调用时机：提交来源模拟请求前调用。
 */
function buildSourceSimulationIdentityMirror(
    panel: SourceSimulationPanelView,
    identityId: string,
    requestId: string,
) {
    const payload = {
        principal: identityId,
        interface: panel.id,
        kind: panel.channel,
        conversation: requestId,
    };
    return JSON.stringify(payload);
}

/**
 * 作用：把失败响应规范化为错误文本。
 * 意图：避免调用方反复手写 Reflect 读取逻辑。
 * 调用时机：来源模拟请求返回非 2xx 时调用。
 */
function readSourceSimulationErrorText(response: Response, payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
        return `HTTP ${response.status}`;
    }
    return String(
        Reflect.get(payload, "error")
        ?? Reflect.get(payload, "msg")
        ?? `HTTP ${response.status}`,
    );
}

/**
 * 作用：从来源模拟接口响应中提取首条 assistant 内容。
 * 意图：把响应结构兼容逻辑集中，避免提交 handler 直接操作原始 payload。
 * 调用时机：来源模拟请求成功后调用。
 */
function readSourceSimulationReplyContent(payload: unknown) {
    if (typeof payload !== "object" || payload === null) {
        return "";
    }
    const choices = Reflect.get(payload, "choices");
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

/**
 * 作用：向来源模拟接口发送请求并读取文本回复。
 * 意图：把 fetch 细节和响应结构兼容逻辑与 UI 状态更新分离。
 * 调用时机：来源模拟提交动作触发时调用。
 */
async function sendSourceSimulationRequest(
    armorToken: string,
    body: Record<string, unknown>,
) {
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
        throw new Error(readSourceSimulationErrorText(response, payload));
    }
    return readSourceSimulationReplyContent(payload);
}

/**
 * 作用：在提交开始时写入用户消息并创建 pending assistant 占位。
 * 意图：保证来源模拟面板的交互反馈时序稳定。
 * 调用时机：通过所有提交前置校验后调用。
 */
function createPendingSourceSimulationMessage(
    panel: SourceSimulationPanelView,
    rawInput: string,
) {
    panel.messages.push(createSourcePanelMessage("user", rawInput, "success"));
    const pendingAssistant = createSourcePanelMessage("assistant", "Waiting response...", "pending");
    panel.messages.push(pendingAssistant);
    panel.loading = true;
    panel.inputValue = "";
    return pendingAssistant;
}

/**
 * 作用：执行来源模拟提交的前置校验。
 * 意图：把 UI 友好的错误提示集中在提交链路最前面，避免后续流程处理非法状态。
 * 调用时机：提交来源模拟请求前调用。
 */
function validateSourceSimulationSubmission(
    panel: SourceSimulationPanelView | null,
    profile: SourceSimulationProfileView | null,
    rawInput: string,
) {
    if (!panel || panel.loading) {
        return "skip";
    }
    if (!rawInput) {
        return "skip";
    }
    if (!profile) {
        panel.messages.push(createSourcePanelMessage("error", "Invalid source profile.", "error"));
        return "stop";
    }
    const identityId = panel.identityId.trim();
    const password = panel.password.trim();
    // 来源模拟请求依赖显式身份认证，缺失 identity 或 password 时不能继续发起请求。
    if (!identityId || !password) {
        panel.messages.push(createSourcePanelMessage("error", "identity/password required for simulation.", "error"));
        return "stop";
    }
    return "ok";
}

/**
 * 作用：构造来源模拟接口请求体。
 * 意图：把请求载荷拼装与提交主流程分离，降低提交流程函数体积。
 * 调用时机：登录成功并准备发起来源模拟请求时调用。
 */
function buildSourceSimulationRequestBody(
    panel: SourceSimulationPanelView,
    sourceContext: SourceSimulationContext,
    identityId: string,
    modelName: string,
    rawInput: string,
) {
    const sourcePayload = `<magi_request_source>${JSON.stringify(sourceContext)}</magi_request_source>`;
    return {
        model: modelName,
        stream: false,
        user: buildSourceSimulationIdentityMirror(panel, identityId, sourceContext.requestId),
        messages: [
            { role: "system", content: sourcePayload },
            { role: "user", content: rawInput },
        ],
    };
}

/**
 * 作用：把来源模拟成功回复写回 pending assistant。
 * 意图：把成功态写回逻辑从提交流程中抽离，保持主流程聚焦在时序编排。
 * 调用时机：来源模拟接口成功返回后调用。
 */
function applySourceSimulationSuccess(
    pendingAssistant: ReturnType<typeof createSourcePanelMessage>,
    reply: string,
) {
    pendingAssistant.content = reply || "[empty response]";
    pendingAssistant.status = "success";
    pendingAssistant.timestamp = Date.now();
}

/**
 * 作用：把来源模拟失败信息写回 pending assistant。
 * 意图：把失败态写回逻辑从提交流程中抽离，保持主流程聚焦在时序编排。
 * 调用时机：来源模拟接口抛错后调用。
 */
function applySourceSimulationFailure(
    pendingAssistant: ReturnType<typeof createSourcePanelMessage>,
    error: unknown,
) {
    pendingAssistant.content = error instanceof Error ? error.message : String(error);
    pendingAssistant.role = "error";
    pendingAssistant.status = "error";
    pendingAssistant.timestamp = Date.now();
}

/**
 * 作用：处理来源模拟提交动作。
 * 意图：串联画像校验、身份登录、请求发送和消息回写。
 * 调用时机：来源模拟面板点击提交按钮时调用。
 */
async function handleSubmitSourceSimulationPanel(
    state: ReturnType<typeof createMagiRootState>,
    panelId: string,
) {
    const panel = findSourcePanel(state, panelId);
    const rawInput = panel ? panel.inputValue.trim() : "";
    const profile = panel ? findSourceProfile(state, panel.selectedProfileId) : null;
    const validationResult = validateSourceSimulationSubmission(panel, profile, rawInput);
    if (validationResult !== "ok" || !panel || !profile) {
        return;
    }

    const sourceContext = buildSourceSimulationContext(profile, panel);
    const identityId = panel.identityId.trim();
    const password = panel.password.trim();
    const nickname = panel.nickname.trim() || identityId;
    const modelName = panel.requestModel.trim() || "magi-default";
    const pendingAssistant = createPendingSourceSimulationMessage(panel, rawInput);

    try {
        const loginSession = await loginMagiIdentity({
            identityId,
            password,
            nickname,
            channel: panel.channel,
            activate: false,
        });
        const requestBody = buildSourceSimulationRequestBody(
            panel,
            sourceContext,
            loginSession.identityId,
            modelName,
            rawInput,
        );
        const reply = await sendSourceSimulationRequest(loginSession.armorToken, requestBody);
        applySourceSimulationSuccess(pendingAssistant, reply);
    } catch (error) {
        applySourceSimulationFailure(pendingAssistant, error);
    } finally {
        panel.loading = false;
    }
}

/**
 * 作用：创建来源模拟提交 handler。
 * 意图：把 rootctx 状态闭包绑定到提交动作，同时避免入口层直接书写匿名箭头函数。
 * 调用时机：`createSourceSimulationHandlers` 组装 handler 时调用。
 */
/** @同步豁免: UI构建 — setup 阶段需要同步返回异步提交处理器闭包。 */
export function createSourceSimulationSubmitHandler(
    state: ReturnType<typeof createMagiRootState>,
) {
    return async (panelId: string) => handleSubmitSourceSimulationPanel(state, panelId);
}
