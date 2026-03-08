/**
 * SSETextDisplay 类型守卫
 *
 * 为SSE流式响应JSON解析提供运行时类型验证。
 */

/** SSE响应中的delta结构 */
interface SSEDelta {
    content?: string;
}

/** SSE响应中的choice结构 */
interface SSEChoice {
    delta?: SSEDelta;
}

/** SSE响应的顶层结构 */
interface SSEChunkPayload {
    choices?: SSEChoice[];
}

/**
 * 验证parsed JSON是否为有效的SSE chunk payload
 *
 * 作用：替代 as 断言，提供运行时类型安全
 * 调用时机：extractDeltaFromSSE 解析JSON后调用
 */
export const isSSEChunkPayload = (value: unknown): value is SSEChunkPayload => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    // choices 可选，但如果存在必须是数组
    if ("choices" in obj && !Array.isArray(obj.choices)) {
        return false;
    }
    return true;
};

/**
 * 从已验证的SSE payload中安全提取delta内容
 *
 * 作用：避免数组下标后直接访问属性的lint违规
 * 调用时机：isSSEChunkPayload 验证通过后调用
 */
export async function extractContentFromPayload(
    payload: SSEChunkPayload,
): Promise<string> {
    const choices = payload.choices;
    if (!choices || choices.length === 0) {
        return "";
    }
    const firstChoice = choices[0];
    return firstChoice?.delta?.content ?? "";
}
