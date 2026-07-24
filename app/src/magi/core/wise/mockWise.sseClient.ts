/** 用途：校验流式响应 chunk；使用范围：SSE 消息解析；解耦评估：独立类型守卫。 */
import { 是AI响应Chunk } from "./wise.guard";
/** 用途：提取标准桥接 chunk；使用范围：SSE 消息转换；解耦评估：纯转换函数。 */
import { 提取桥接Chunk数据 } from "./mockWise.streamBridge";
/** 用途：构建标准 SSE 数据行；使用范围：桥接缓冲写入；解耦评估：纯转换函数。 */
import { 构建桥接SSE行 } from "./mockWise.streamBridge";
/** 用途：标注上下文消息；使用范围：请求消息构造；解耦评估：纯类型依赖。 */
import type { ContextMessage } from "../core.types";
/** 用途：标注 OpenAI 兼容配置；使用范围：请求参数；解耦评估：纯类型依赖。 */
import type { OpenAICompatConfig } from "../core.types";
/** 用途：标注工具选项；使用范围：请求体工具字段；解耦评估：纯类型依赖。 */
import type { ReplyOptions } from "../core.types";
/** 用途：标注 SSE 桥接状态；使用范围：回调共享状态；解耦评估：纯类型依赖。 */
import type { SSE桥接状态 } from "./wise.types";

/** 构建 OpenAI 兼容 SSE 请求配置。 */
export const 构建SSE请求配置 = async (
    options: {
        openAIConfig: OpenAICompatConfig;
        messages: ContextMessage[];
        systemPrompt: string;
        abortSignal: AbortSignal;
        toolOptions?: {
        tools?: ReplyOptions["tools"];
        toolChoice?: ReplyOptions["toolChoice"];
        };
    },
) => ({
    url: `${options.openAIConfig.base_url.replace(/\/$/, "")}/chat/completions`,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${options.openAIConfig.apiKey}`,
    },
    body: JSON.stringify({
        model: options.openAIConfig.model,
        temperature: options.openAIConfig.temperature,
        max_tokens: options.openAIConfig.max_tokens,
        stream: true,
        messages: [
            { role: "system", content: options.systemPrompt },
            ...options.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
        ...(Array.isArray(options.toolOptions?.tools) && options.toolOptions.tools.length > 0
            ? { tools: options.toolOptions.tools }
            : {}),
        ...(options.toolOptions?.toolChoice ? { tool_choice: options.toolOptions.toolChoice } : {}),
    }),
    signal: options.abortSignal,
    timeout: 30000,
});

/** 解析一条 SSE 消息并写入桥接状态。 */
function 处理SSE消息数据(
    dataStr: string,
    状态: SSE桥接状态,
    通知有新数据: () => void,
) {
    const parsed: unknown = JSON.parse(dataStr);
    if (!是AI响应Chunk(parsed)) {
        return;
    }
    if (parsed.error) {
        状态.流错误 = new Error(parsed.error.message);
        通知有新数据();
        return;
    }
    const 首个选择 = parsed.choices?.[0];
    if (!首个选择) {
        return;
    }
    const bridgedChoice = 提取桥接Chunk数据(首个选择);
    if (!bridgedChoice.hasPayload) {
        return;
    }
    if (bridgedChoice.content) {
        状态.累积响应内容 += bridgedChoice.content;
    }
    const SSE行 = 构建桥接SSE行(
        { id: parsed.id, created: parsed.created, model: parsed.model },
        bridgedChoice,
    );
    状态.缓冲队列.push(SSE行);
    通知有新数据();
}

/** 创建把回调式网络流写入 AsyncGenerator 共享状态的桥接回调。 */
export const 创建SSE桥接回调 = async (
    状态: SSE桥接状态,
    通知有新数据: () => void,
) => ({
    /** 接收网络层消息，在流消费期间解析并唤醒等待中的 generator。 */
    onMessage(dataStr: string) {
        try {
            处理SSE消息数据(dataStr, 状态, 通知有新数据);
        } catch {
            // 心跳包或非 JSON 行不进入消息缓冲。
        }
    },
    /** 标记网络流完成并唤醒 generator，使其排空剩余缓冲。 */
    onDone() {
        状态.流已完成 = true;
        通知有新数据();
    },
    /** 保存网络异常并唤醒 generator，使错误沿异步迭代器显式抛出。 */
    onError(error: Error) {
        状态.流错误 = error;
        通知有新数据();
    },
});
