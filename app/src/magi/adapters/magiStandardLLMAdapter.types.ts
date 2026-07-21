/**
 * 用途：导入ChatResponseData类型用于后端转发结果
 * 使用范围：BackendForwardResult接口中使用
 * 解耦评估：类型定义无法解耦
 */
import type { ChatResponseData } from "./imports";

/**
 * 用途：表示 MAGI 流式后端请求是否完整通过协议校验。
 * 使用场景：backend adapter 向主 adapter 返回成功状态或明确失败原因。
 * 关联类型：与 BackendForwardResult 分别承载流式和同步请求结果。
 */
export interface BackendStreamResult {
    reason: string;
    success: boolean;
}

/**
 * 后端转发结果接口
 * 
 * 作用：封装后端请求的响应结果和失败原因
 * 意图：统一处理后端转发的成功和失败情况
 */
export interface BackendForwardResult {
    response: ChatResponseData | null;
    reason: string;
}

/**
 * MAGI接口身份标识
 * 
 * 作用：标识MAGI接口的身份信息
 * 意图：区分不同来源的MAGI请求（主界面或源面板）
 */
export interface MagiInterfaceIdentity {
    principalId: string;
    interfaceId: string;
    interfaceKind: "magi-main-ui" | "magi-source-panel";
    interfaceLabel: string;
    conversationId: string;
}

/**
 * 安全源通道类型
 * 
 * 作用：定义允许的源通道类型
 * 意图：限制源通道的取值范围，确保类型安全
 */
export type SafeSourceChannel = "guardian" | "external-agent" | "system-cron" | "unknown";
