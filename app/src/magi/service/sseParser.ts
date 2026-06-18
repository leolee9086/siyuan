/** 用途：AI 聊天响应数据的 Zod schema，用于运行时校验 SSE 数据格式。使用范围：SSE 流式数据解析和验证。解耦评估：网络请求工具模块，通过 imports.ts 转发可降低路径耦合。 */
import { chatResponseDataSchema } from "../../ai/types";

/**
 * 解析和验证流式响应数据
 *
 * 意图：作为SSE数据处理管道的第一步，确保后续处理拿到的数据符合预期格式
 * 调用时机：每收到一条SSE消息时由 handleOpenAILikeStreamResponse 调用
 *
 * 注意：调用方（fetchStream.ts）已剥离 "data: " 前缀和 "[DONE]" 标记，
 * 此函数接收的是纯JSON字符串，不再需要处理SSE协议层格式
 *
 * @param dataStr - SSE data字段的原始JSON字符串（已由fetchStream剥离前缀）
 * @returns 解析后的响应数据对象，验证失败或出错时返回null
 */
/** @同步豁免: 性能考虑 - SSE流式回调的同步处理器，异步化会导致消息处理顺序不确定 */
export const parseAndValidateStreamData = (dataStr: string) => {
    try {
        const cleanDataStr = dataStr.trim();

        // 空字符串直接跳过
        if (!cleanDataStr) {
            return null;
        }

        // 解析JSON数据
        const rawData = JSON.parse(cleanDataStr);

        // 使用zod验证数据格式
        const parseResult = chatResponseDataSchema.safeParse(rawData);
        if (!parseResult.success) {
            return null;
        }

        const data = parseResult.data;

        // 处理错误
        if (data.error) {
            return null;
        }

        return data;
    } catch {
        return null;
    }
};
