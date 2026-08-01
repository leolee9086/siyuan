/** 调用显式生成器并校验 Kernel 接受的节点 ID 格式。 */
/** @同步豁免: 生命周期 - 会话及消息条目在写入运行时状态和 DOM 前必须立即取得同一个完整节点 ID。 */
export function createAgentSessionID(generateNodeID: () => string) {
    const id = generateNodeID();
    if (!/^\d{14}-[a-z0-9]{7}$/.test(id)) {
        throw new Error(`Invalid Agent session ID: ${id}`);
    }
    return id;
}
