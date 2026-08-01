/** 从未知 API 包络中读取数字状态码和可选消息。 */
export function readAPIResult(value: unknown) {
    if (!value || typeof value !== "object") {
        return {};
    }
    const code = Reflect.get(value, "code");
    const msg = Reflect.get(value, "msg");
    return {
        ...(typeof code === "number" ? {code} : {}),
        ...(typeof msg === "string" ? {msg} : {}),
    };
}
