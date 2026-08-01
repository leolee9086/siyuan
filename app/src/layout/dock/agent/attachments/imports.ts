/** 用途：发送 Agent 附件请求；使用范围：上传命令；解耦评估：网络实现只在领域网关暴露，动态身份仍由组合根端口注入。 */
import {fetchSyncPost} from "../../../../util/network/fetch";
/** 用途：约束组合根提供的动态请求头；使用范围：附件上传。 */
import type {AgentRequestHeaders} from "../request/AgentRequest.types";
/** 用途：校验上传响应包络；使用范围：附件上传；解耦评估：复用请求领域的纯包络校验，避免附件领域复制协议。 */
import {requireAgentAPIData} from "../request/AgentRequest.response";

/** 导出统一网络入口。 */
export {fetchSyncPost};
/** 导出请求头能力类型。 */
export type {AgentRequestHeaders};
/** 导出 Agent API 数据校验。 */
export {requireAgentAPIData};
