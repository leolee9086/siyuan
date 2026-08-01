/** 用途：约束 Agent API 的统一包络；使用范围：请求响应边界。 */
import type {AgentAPIResponse} from "./AgentRequest.types";

/** 校验 Agent API 成功包络并返回明确存在的数据。 */
/** @同步豁免: 类型守卫 - 仓储必须在消费响应数据前立即阻断失败或缺失的 API 包络。 */
export function requireAgentAPIData<T>(
    response: AgentAPIResponse<T> | null | undefined,
    operation: string,
) {
    if (!response || response.code !== 0) {
        throw new Error(response?.msg || `${operation} failed`);
    }
    if (!Object.prototype.hasOwnProperty.call(response, "data") || typeof response.data === "undefined") {
        throw new Error(`${operation} returned no data`);
    }
    return response.data;
}

/** 校验不返回业务数据的 Agent API 调用。 */
/** @同步豁免: 类型守卫 - 无数据命令必须在继续更新本地状态前立即确认 API 成功。 */
export function requireAgentAPISuccess(
    response: AgentAPIResponse<unknown> | null | undefined,
    operation: string,
) {
    if (!response || response.code !== 0) {
        throw new Error(response?.msg || `${operation} failed`);
    }
}
