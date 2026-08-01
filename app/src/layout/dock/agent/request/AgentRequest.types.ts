/** Agent 请求的认证和协议范围。 */
export type AgentRequestScope = "default" | "app" | "checkpoint";

/** 生成 Agent 请求头所需的显式调用输入。 */
export type AgentRequestHeaderInput = {
    scope?: AgentRequestScope;
    headers?: Record<string, string>;
};

/** 由组合根提供的请求头生成能力；每次调用都会重新读取动态身份。 */
export type AgentRequestHeaders = (input?: AgentRequestHeaderInput) => Record<string, string>;

/** Agent API 的统一返回包络。 */
export interface AgentAPIResponse<T> {
    code: number;
    msg?: string;
    data?: T;
}
