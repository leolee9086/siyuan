/** 校验 WebSocket 会话变更载荷的最小字段。 */
export function readSessionChangePayload(value: unknown) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const sessionID = Reflect.get(value, "sessionID");
    const action = Reflect.get(value, "action");
    return typeof sessionID === "string" && typeof action === "string" ? {sessionID, action} : null;
}
