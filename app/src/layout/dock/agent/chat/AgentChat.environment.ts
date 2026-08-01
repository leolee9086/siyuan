/** 读取 AgentChat 操作所需的已初始化配置。 */
export function requireSiyuanConfig() {
    const config = window.siyuan.config;
    if (!config) {
        throw new Error("SiYuan configuration is unavailable during AgentChat operation");
    }
    return config;
}

/** 读取 AgentChat 当前界面语言资源。 */
export function getAgentChatLanguages() {
    return window.siyuan.languages;
}
