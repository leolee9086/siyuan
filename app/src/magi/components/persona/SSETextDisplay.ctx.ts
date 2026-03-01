/**
 * SSETextDisplay 组件逻辑上下文
 *
 * 从 SSETextDisplay.vue 提取的SSE流式生成逻辑。
 * 原始实现依赖 AISSEConversation（toread路径），迁移后使用 universalStreamRequest。
 */

import { ref, nextTick, type Ref } from "vue";
import { universalStreamRequest } from "../../../util/network/fetchStream";
import type { SSETextDisplayProps, SSETextDisplayEmits, SSEApiConfig } from "./SSETextDisplay.types";
import { isSSEChunkPayload } from "./SSETextDisplay.guard";
import { getMagiI18nText } from "../../utils/magiI18n";

/**
 * 构建OpenAI兼容的SSE请求配置
 *
 * 作用：将组件的apiConfig和promptContent转换为universalStreamRequest可接受的参数
 * 意图：集中管理请求构建逻辑，与流处理解耦
 * 调用时机：executeGeneration 发起请求前调用
 */
async function buildRequestConfig(
    apiConfig: SSEApiConfig,
    promptContent: string,
    signal: AbortSignal,
) {
    return {
        url: `${apiConfig.endpoint}chat/completions`,
        method: "POST" as const,
        headers: {
            "Authorization": `Bearer ${apiConfig.apiKey}`,
            "Content-Type": "application/json",
        },
        body: {
            model: apiConfig.model,
            messages: [{ role: "user", content: promptContent }],
            stream: true,
            temperature: apiConfig.temperature ?? 0.7,
            max_tokens: apiConfig.maxTokens ?? 4096,
        },
        timeout: 30000,
        signal,
    };
}


/**
 * 同步版本的SSE delta提取（供onMessage同步回调使用）
 *
 * 作用：在同步回调中解析SSE JSON并提取增量内容
 * 意图：universalStreamRequest的onMessage是同步回调，无法await
 * 调用时机：onMessage回调内部调用
 * @同步豁免: 性能考虑 - SSE流式回调的同步处理器，异步化会导致消息处理顺序不确定
 */
function extractDeltaSync(dataStr: string): string {
    try {
        const parsed: unknown = JSON.parse(dataStr);
        if (!isSSEChunkPayload(parsed)) {
            return "";
        }
        const choices = parsed.choices;
        if (!choices || choices.length === 0) {
            return "";
        }
        const firstChoice = choices[0];
        return firstChoice?.delta?.content ?? "";
    } catch {
        return "";
    }
}

/**
 * 滚动文本容器到底部
 *
 * 作用：流式内容更新后自动滚动到最新位置
 * 意图：提取为命名函数避免内联回调超长
 * 调用时机：每次SSE chunk写入后由nextTick回调触发
 */
function scrollContainerToBottom(containerRef: Ref<HTMLElement | null>): void {
    const container = containerRef.value;
    if (!container) {
        return;
    }
    requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
    });
}

/**
 * 执行SSE流式生成请求
 *
 * 作用：发起流式请求，逐chunk更新文本内容并自动滚动容器
 * 意图：将SSE通信逻辑从组件中提取，支持中止和错误处理
 * 调用时机：handleGenerate 中调用
 */
async function executeGeneration(
    props: SSETextDisplayProps,
    textContent: Ref<string>,
    error: Ref<string>,
    textContainerRef: Ref<HTMLElement | null>,
    signal: AbortSignal,
): Promise<void> {
    const chunks: string[] = [];
    const requestConfig = await buildRequestConfig(
        props.apiConfig, props.promptContent, signal,
    );

    await universalStreamRequest(requestConfig, {
        /** onMessage: 接收单条SSE数据，提取delta内容并追加到文本 */
        onMessage: (dataStr: string) => {
            const content = extractDeltaSync(dataStr);
            if (!content) {
                return;
            }
            chunks.push(content);
            textContent.value = chunks.join("");
            nextTick(() => scrollContainerToBottom(textContainerRef));
        },
        /** onDone: 流正常结束，状态重置由外层finally处理 */
        onDone: () => { /* noop — 由外层 finally 处理状态重置 */ },
        /** onError: 流异常时写入错误信息 */
        onError: (err: Error) => {
            error.value = `${getMagiI18nText("generationErrorPrefix")}: ${err.message}`;
        },
    });
}

/**
 * 触发SSE流式生成（顶层函数，避免在useSSETextDisplayCtx内定义命名函数）
 *
 * 作用：重置状态、发起SSE请求、完成后通知父组件
 * 意图：作为模板按钮的点击处理器，管理生成生命周期
 * 调用时机：用户点击"开始生成"或"重新生成"按钮时
 */
async function handleGenerate(
    props: SSETextDisplayProps,
    emit: SSETextDisplayEmits,
    textContent: Ref<string>,
    isGenerating: Ref<boolean>,
    error: Ref<string>,
    textContainerRef: Ref<HTMLElement | null>,
    abortRef: { controller: AbortController | null },
): Promise<void> {
    if (isGenerating.value) {
        return;
    }
    // 中止上一次未完成的请求
    abortRef.controller?.abort();
    abortRef.controller = new AbortController();

    isGenerating.value = true;
    textContent.value = "";
    error.value = "";

    try {
        await executeGeneration(
            props, textContent, error, textContainerRef, abortRef.controller.signal,
        );
        emit("generationComplete", {
            system: props.systemName,
            content: textContent.value,
        });
    } catch (err) {
        // 网络层未捕获的异常
        if (err instanceof Error) {
            error.value = `${getMagiI18nText("generationErrorPrefix")}: ${err.message}`;
        }
    } finally {
        isGenerating.value = false;
    }
}

/**
 * 初始化 SSETextDisplay 的全部响应式状态和生成逻辑
 *
 * 作用：管理SSE流式文本生成的状态、中止控制和DOM引用
 * 调用时机：SSETextDisplay.vue 的 setup 阶段调用一次
 */
export async function useSSETextDisplayCtx(
    props: SSETextDisplayProps,
    emit: SSETextDisplayEmits,
    textContent: Ref<string>,
) {
    const isGenerating = ref(false);
    const error = ref("");
    const textContainerRef = ref<HTMLElement | null>(null);
    const abortRef: { controller: AbortController | null } = { controller: null };

    return {
        isGenerating,
        error,
        textContainerRef,
        /** 模板绑定的生成按钮处理器，委托给顶层 handleGenerate 并注入闭包依赖 */
        handleGenerate: () =>
            handleGenerate(props, emit, textContent, isGenerating, error, textContainerRef, abortRef),
    };
}
