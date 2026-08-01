/** 用途：读取应用协议常量；使用范围：Agent 请求头；解耦评估：外部依赖只由本领域网关暴露。 */
import {Constants} from "./imports";
/** 用途：读取当前工作空间 API token；使用范围：Agent 请求头；解耦评估：外部依赖只由本领域网关暴露。 */
import {getSafeSiyuanConfig} from "./imports";
/** 用途：约束请求头调用输入；使用范围：Agent 请求边界。 */
import type {AgentRequestHeaderInput} from "./AgentRequest.types";

/** 在每次 Agent 请求前读取当前工作空间 API token。 */
function workspaceAPIToken() {
    try {
        return String(getSafeSiyuanConfig()?.api?.token ?? "").trim();
    } catch {
        return "";
    }
}

/** 生成带有显式 owner 身份和协议范围的 Agent 请求头。 */
/** @同步豁免: 生命周期 - 每个请求在发出前必须立即读取同一时刻的工作空间和 owner 身份。 */
export function createAgentRequestHeaders(ownerToken: string, input: AgentRequestHeaderInput = {}) {
    const headers: Record<string, string> = {...(input.headers || {})};
    const scope = input.scope || "default";
    const apiToken = workspaceAPIToken();
    // App 广播与检查点写入都依赖应用实例标识，普通读取请求不携带该协议头。
    if (scope === "app" || scope === "checkpoint") {
        headers["X-SiYuan-App-ID"] = Constants.SIYUAN_APPID;
    }
    // 检查点写入使用 JSON 请求体，并声明由 Kernel 执行会话修订冲突检查。
    if (scope === "checkpoint") {
        headers["Content-Type"] = "application/json";
        headers["X-SiYuan-Agent-Checkpoint"] = "2";
    }
    // 调用方显式提供 Authorization 时保留其身份，否则补入当前工作空间 token。
    if (apiToken && !headers.Authorization) {
        headers.Authorization = `Bearer ${apiToken}`;
    }
    if (ownerToken) {
        headers["X-SiYuan-Agent-Owner-Token"] = ownerToken;
    }
    return headers;
}
