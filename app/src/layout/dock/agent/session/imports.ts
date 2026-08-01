/** 用途：发送会话请求；使用范围：会话仓储实现；解耦评估：复用统一网络入口。 */
import {fetchSyncPost} from "../../../../util/network/fetch";
/** 用途：约束组合根提供的动态请求头；使用范围：全部会话请求。 */
import type {AgentRequestHeaders} from "../request/AgentRequest.types";
/** 用途：校验带数据的 Agent API 包络；使用范围：会话读写；解耦评估：纯响应校验由请求领域统一定义，仓储不应复制包络规则。 */
import {requireAgentAPIData} from "../request/AgentRequest.response";
/** 用途：校验无业务数据的 Agent API 包络；使用范围：会话删除；解耦评估：纯响应校验由请求领域统一定义，仓储不应复制包络规则。 */
import {requireAgentAPISuccess} from "../request/AgentRequest.response";
/** 用途：关联会话和任务目录摘要；使用范围：会话领域持久化模型；解耦评估：共享的是任务目录领域数据契约，不引入其仓储实现。 */
import type {TaskDirectoryBinding} from "../task-directory/AgentTaskDirectory.types";

/** 导出统一网络入口。 */
export {fetchSyncPost};
/** 导出请求头能力类型。 */
export type {AgentRequestHeaders};
/** 导出 Agent API 数据校验。 */
export {requireAgentAPIData};
/** 导出 Agent API 成功校验。 */
export {requireAgentAPISuccess};
/** 导出任务目录领域数据契约。 */
export type {TaskDirectoryBinding};
