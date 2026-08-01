/** 校验后端问题参数为对象数组，避免把畸形 SSE 数据写入会话。 */
export function isQuestionList(value: unknown): value is Array<Record<string, unknown>> {
    return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null);
}
