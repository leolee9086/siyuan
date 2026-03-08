/**
 * MAGI 请求相关统一类型定义
 *
 * 合并来源：
 * - requestController.types.ts 的 OnMessageCallback、SiyuanAIConfig
 * - streamChat.types.ts 的 AIRequestParams（已合并入 fetchStream.types.ts 的 StreamRequestConfig）
 *
 * 注意：StreamRequestConfig 统一使用 fetchStream.types.ts 中的定义
 */

// 重导出网络层的 StreamRequestConfig 作为统一的请求配置类型
export type { StreamRequestConfig } from "../../util/network/fetchStream.types";

/**
 * 消息回调函数类型
 *
 * 用途：AI流式响应中每条消息的回调处理
 * 使用场景：AIRequestController 的 onMessage 事件
 */
export type OnMessageCallback = ((content: string, getCurrentContent?: () => string) => void) & {
    getResponseContentRef?: () => { textContent: string };
};
