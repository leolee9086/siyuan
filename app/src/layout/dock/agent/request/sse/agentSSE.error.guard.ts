/** 判断未知错误是否表示调用方主动中止请求。 */
export function isAgentSSEAbortError(error: unknown): error is Error {
    return error instanceof Error && error.name === "AbortError";
}

/** 判断未知错误是否由 Agent SSE 协议解析器产生。 */
export function isAgentSSEProtocolError(error: unknown): error is Error {
    return error instanceof Error && error.name === "AgentSSEProtocolError";
}

/** 判断未知错误是否为会话实例互斥导致的 HTTP 409。 */
export function isAgentHTTPConflictError(error: unknown): error is Error {
    return error instanceof Error && error.name === "AgentHttpError" && Reflect.get(error, "status") === 409;
}

/** 从未知失败值中读取可用于超时分类的消息。 */
export function readAgentSSEErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "";
}

/** 从 Kernel JSON 包络中读取错误消息，忽略非对象和非字符串字段。 */
export function readAgentResponseErrorMessage(value: unknown) {
    if (!value || typeof value !== "object") {
        return "";
    }
    const message = Reflect.get(value, "msg") || Reflect.get(value, "message");
    return typeof message === "string" ? message : "";
}
