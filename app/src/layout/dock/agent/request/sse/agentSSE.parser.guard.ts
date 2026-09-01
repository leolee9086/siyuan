/** 用途：创建具名协议错误；使用范围：JSON 和事件种类校验失败；解耦评估：同一 SSE 领域直接依赖错误工厂。 */
import {createAgentSSEProtocolError} from "./agentSSE.error.factory";
/** 用途：约束解析后的协议事件；使用范围：全部事件构建函数；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {ISSEResult} from "./agentSSE.types";
/** 用途：约束确认事件的影响字段；使用范围：confirm 载荷解析；解耦评估：同一 SSE 领域的数据契约直接依赖。 */
import type {IToolEffects} from "./agentSSE.types";
/** 用途：约束交互终态；使用范围：resolved 事件构建。 */
import type {AgentInteractionResolutionStatus} from "./agentSSE.types";

/** 将协议字符串保留为交互终态类型；未知状态由终态处理器按 error 展示。 */
function readInteractionStatus(data: Record<string, unknown>): AgentInteractionResolutionStatus {
    const status = data.status;
    // 只有协议声明的终态可以进入判别联合，未知扩展值按 error 前向兼容。
    if (status === "approved" || status === "always" || status === "rejected" || status === "submitted" ||
        status === "completed" || status === "expired" || status === "cancelled" || status === "error") {
        return status;
    }
    return "error";
}

function readRoundID(data: Record<string, unknown>) {
    return typeof data.roundID === "string" && data.roundID ? {roundID: data.roundID} : {};
}

/** @显式返回类型原因 各事件构建器共同组成 ISSEResult 判别联合，固定边界可阻止字符串字面量在组合时被拓宽。 */
function buildAgentTextEvent(event: string, data: Record<string, unknown>): ISSEResult | null {
    // turn 事件建立当前服务端轮次标识，后续保存和恢复均依赖该值。
    if (event === "turn") {
        return {type: "turn", turnID: data.turnID as string};
    }
    // content 事件携带最终回答的增量文本。
    if (event === "content") {
        return {type: "content", token: data.token as string, ...readRoundID(data)};
    }
    // thinking 事件携带兼容旧协议的思考文本。
    if (event === "thinking") {
        return {type: "thinking", reasoning: data.reasoning as string, ...readRoundID(data)};
    }
    // error 事件由服务端显式结束当前轮次并展示原因。
    if (event === "error") {
        return {type: "error", message: data.message as string};
    }
    // interrupted 事件表示当前轮次被用户或另一生命周期命令中断。
    if (event === "interrupted") {
        return {type: "interrupted", message: data.message as string};
    }
    // done 事件提交服务端确认的最终轮次标识。
    if (event === "done") {
        return {type: "done", turnID: data.turnID as string};
    }
    // reasoning 事件携带新版协议的思考增量。
    if (event === "reasoning") {
        return {type: "reasoning", token: data.token as string, ...readRoundID(data)};
    }
    // snapshot 事件记录工具执行前由 Kernel 创建的快照标识。
    if (event === "snapshot") {
        return {type: "snapshot", snapshotID: data.snapshotID as string, ...readRoundID(data)};
    }
    return null;
}

/** @显式返回类型原因 工具事件必须保持 ISSEResult 的判别字段，供聊天分派器按 type 收窄。 */
function buildAgentToolEvent(event: string, data: Record<string, unknown>): ISSEResult | null {
    // tool_call 事件建立可与后续进度和结果关联的调用标识。
    if (event === "tool_call") {
        return {
            type: "tool_call",
            name: data.name as string,
            callID: (data.callID as string) || "",
            arguments: (data.arguments || {}) as Record<string, unknown>,
            ...readRoundID(data),
        };
    }
    // tool_result 事件以 callID 结算对应的工具卡片。
    if (event === "tool_result") {
        return {
            type: "tool_result",
            name: data.name as string,
            callID: (data.callID as string) || "",
            result: data.result as string,
            ...readRoundID(data),
        };
    }
    return null;
}

/** @显式返回类型原因 交互事件必须保持 ISSEResult 的终态字段，供卡片状态机按 type 收窄。 */
function buildAgentInteractionEvent(event: string, data: Record<string, unknown>): ISSEResult | null {
    // confirm 事件冻结待用户批准的工具参数及其影响范围。
    if (event === "confirm") {
        return {
            type: "confirm",
            name: data.name as string,
            arguments: (data.arguments || {}) as Record<string, unknown>,
            confirmID: data.confirmID as string,
            ...(data.effects && typeof data.effects === "object"
                ? {effects: data.effects as IToolEffects}
                : {}),
            ...(typeof data.forcedConfirm === "boolean" ? {forcedConfirm: data.forcedConfirm} : {}),
            ...(typeof data.capabilityID === "string" ? {capabilityID: data.capabilityID} : {}),
            ...readRoundID(data),
        };
    }
    // confirm_resolved 携带 Kernel 给出的明确终态，卡片层无需等待工具结果文本。
    if (event === "confirm_resolved") {
        return {
            type: "confirm_resolved",
            confirmID: data.confirmID as string,
            callID: (data.callID as string) || "",
            status: readInteractionStatus(data),
            message: (data.message as string) || "",
        };
    }
    // 浏览器能力事件由当前应用实例按 capability ID 和 generation 执行。
    if (event === "browser_capability_call") {
        return {
            type: "browser_capability_call",
            callID: data.callID as string,
            name: data.name as string,
            capabilityID: data.capabilityID as string,
            generation: Number(data.generation) || 0,
            arguments: (data.arguments || {}) as Record<string, unknown>,
        };
    }
    // frontend_tool_call 事件交由当前宿主提供的插件动作执行器处理。
    if (event === "frontend_tool_call") {
        return {
            type: "frontend_tool_call",
            callID: data.callID as string,
            name: data.name as string,
            arguments: (data.arguments || {}) as Record<string, unknown>,
        };
    }
    // frontend_tool_resolved 只结算调用生命周期，不创建额外可见工具卡片。
    if (event === "frontend_tool_resolved") {
        return {
            type: "frontend_tool_resolved",
            callID: data.callID as string,
            status: readInteractionStatus(data),
            message: (data.message as string) || "",
        };
    }
    return null;
}

/** @显式返回类型原因 进度事件的嵌套字段必须满足 ISSEResult 中 tool_progress 的固定结构。 */
function buildAgentToolProgress(data: Record<string, unknown>): ISSEResult {
    const rawProgress = (data.progress || {}) as Record<string, unknown>;
    const rawResults = Array.isArray(rawProgress.latestResults) ? rawProgress.latestResults : [];
    return {
        type: "tool_progress",
        name: data.name as string,
        callID: (data.callID as string) || "",
        progress: {
            phase: String(rawProgress.phase || "update"),
            done: Number(rawProgress.done) || 0,
            total: Number(rawProgress.total) || 0,
            ...(typeof rawProgress.current === "string" ? {current: rawProgress.current} : {}),
            ...(typeof rawProgress.partialCount === "number" ? {partialCount: rawProgress.partialCount} : {}),
            latestResults: rawResults
                .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
                .map((item) => ({
                    title: typeof item.title === "string" ? item.title : "",
                    url: typeof item.url === "string" ? item.url : "",
                    engine: typeof item.engine === "string" ? item.engine : "",
                })),
        },
    };
}

/** @显式返回类型原因 状态事件必须保持 ISSEResult 的数值默认值和判别字段。 */
function buildAgentStateEvent(event: string, data: Record<string, unknown>): ISSEResult | null {
    // usage 事件更新令牌消耗和上下文窗口指标。
    if (event === "usage") {
        return {
            type: "usage",
            promptTokens: (data.promptTokens as number) || 0,
            completionTokens: (data.completionTokens as number) || 0,
            lastPromptTokens: (data.lastPromptTokens as number) || 0,
            tokenBreakdown: (data.tokenBreakdown as Record<string, number>) || {},
            cachedTokens: (data.cachedTokens as number) || 0,
            contextLimit: (data.contextLimit as number) || 0,
        };
    }
    // retry 事件展示当前重试次数和上限。
    if (event === "retry") {
        return {
            type: "retry",
            attempt: (data.attempt as number) || 1,
            maxRetries: (data.maxRetries as number) || 1,
        };
    }
    // permission 事件同步内核运行期会话权限模式。
    if (event === "permission" && (data.permissionMode === "confirm" || data.permissionMode === "allowSession")) {
        return {type: "permission", permissionMode: data.permissionMode};
    }
    // question 事件把结构化提问转交给聊天交互层。
    if (event === "question") {
        return {
            type: "question",
            questionID: data.questionID as string,
            arguments: (data.arguments || {}) as Record<string, unknown>,
            ...readRoundID(data),
        };
    }
    if (event === "question_resolved") {
        return {
            type: "question_resolved",
            questionID: data.questionID as string,
            callID: (data.callID as string) || "",
            status: readInteractionStatus(data),
            message: (data.message as string) || "",
            answers: Array.isArray(data.answers)
                ? data.answers.filter((answer): answer is string => typeof answer === "string")
                : [],
        };
    }
    return null;
}

/** @显式返回类型原因 解析入口需要以 null 表示未知事件，再由公开校验函数转为协议错误。 */
function buildAgentSSEEvent(event: string, data: Record<string, unknown>): ISSEResult | null {
    // 工具进度拥有独立的嵌套标准化流程，先于通用事件分组处理。
    if (event === "tool_progress") {
        return buildAgentToolProgress(data);
    }
    return buildAgentTextEvent(event, data) || buildAgentToolEvent(event, data) ||
        buildAgentInteractionEvent(event, data) || buildAgentStateEvent(event, data);
}

/**
 * 解析一帧 Agent SSE 数据；畸形载荷和未知事件均作为协议错误抛出。
 * @同步豁免: 类型守卫 - 每一帧必须在 onEvent 前同步完成校验，异步解析会破坏 SSE 帧顺序。
 * @显式返回类型原因 公开协议解析器必须固定返回 ISSEResult，避免 JSON.parse 的 any 污染调用方。
 */
export function parseAgentSSEEvent(event: string, payload: string): ISSEResult {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(payload) as Record<string, unknown>;
    } catch (error) {
        throw createAgentSSEProtocolError(`Invalid Agent SSE payload for event "${event}"`, error);
    }
    const result = buildAgentSSEEvent(event, data);
    if (!result) {
        throw createAgentSSEProtocolError(`Unsupported Agent SSE event "${event}"`);
    }
    return result;
}
