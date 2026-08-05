/** 用途：复用工具副作用类型；使用范围：确认卡片影响信息。 */
import type {IToolEffects} from "./imports";

/** 描述确认卡片构建所需的已格式化展示数据。 */
export interface ConfirmCardInput {
    name: string;
    args: Record<string, unknown>;
    category: string;
    effectsHTML: string;
}

/** 描述提交一次确认决定所需的稳定会话和条目标识。 */
export interface ConfirmRequest {
    confirmID: string;
    approved: boolean;
    always: boolean;
    sessionID: string;
    confirmEntryID: string;
}

/** 描述 Kernel 或结构化 API 失败对确认卡片给出的明确终态。 */
export interface ConfirmResolution {
    confirmID: string;
    status: import("../../../request/sse/agentSSE.types").AgentInteractionResolutionStatus;
    message?: string;
}

/** 描述 SSE 确认事件创建卡片时携带的原始工具数据。 */
export interface AppendConfirmInput {
    name: string;
    args: Record<string, unknown>;
    confirmID: string;
    effects?: IToolEffects;
}

/** 描述前端工具结果回传的数据。 */
export interface FrontendToolResultInput {
    sessionID: string;
    callID: string;
    result: string;
    isError: boolean;
}
