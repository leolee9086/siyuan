/** 用途：约束欢迎流程读写的聊天状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：渲染欢迎内容；使用范围：空会话界面；解耦评估：复用统一消息渲染模板，避免欢迎领域复制 HTML。 */
import {renderWelcomeHTML} from "../../../AgentMessageRenderer";
/** 导出欢迎内容渲染函数。 */
export {renderWelcomeHTML};

/** 用途：计算当前目标策略；使用范围：欢迎内容与操作；解耦评估：纯策略函数通过网关进入，不加载面板宿主。 */
import {resolveTargetPolicy} from "../model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};
/** 用途：打开人工智能设置；使用范围：欢迎界面设置入口；解耦评估：动作复用 Composer 已有宿主能力边界。 */
import {openAiSetting} from "../composer/AgentChat.composer";
/** 导出设置导航命令。 */
export {openAiSetting};

/** 用途：保存欢迎示例轮次；使用范围：旧链路请求发出前；解耦评估：网关转出会话持久化唯一入口，欢迎模块不读取仓储实现。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};
/** 用途：恢复冲突后的会话；使用范围：旧链路保存失败处理；解耦评估：会话重载由持久化领域集中维护。 */
import {reloadFromDisk} from "../../session/persistence/AgentChat.reload";
/** 导出会话重载命令。 */
export {reloadFromDisk};
/** 用途：分派欢迎示例请求；使用范围：欢迎示例点击；解耦评估：原生 Agent 与 MAGI 路由保持在发送领域。 */
import {dispatchAgentChatWelcome} from "../../message/sending/AgentChat.send.helpers";
/** 导出欢迎请求分派命令。 */
export {dispatchAgentChatWelcome};
/** 用途：渲染用户消息；使用范围：旧链路欢迎示例轮次；解耦评估：用户消息 DOM 继续由唯一消息模块拥有。 */
import {appendUserMessage} from "../../message/user/AgentChat.userMessage";
/** 导出用户消息追加命令。 */
export {appendUserMessage};
/** 用途：重建消息导航；使用范围：旧链路欢迎示例轮次；解耦评估：导航索引由导航领域集中维护。 */
import {rebuildNavMarkers} from "../../ui/navigation/AgentChat.navigation";
/** 导出导航重建命令。 */
export {rebuildNavMarkers};
/** 用途：生成会话标题；使用范围：旧链路欢迎示例轮次；解耦评估：标题副作用继续由响应收尾领域维护。 */
import {tryGenerateTitle} from "../../stream/response/AgentChat.finish.methods";
/** 导出标题生成命令。 */
export {tryGenerateTitle};
/** 用途：控制流式状态；使用范围：旧链路欢迎示例轮次；解耦评估：交互状态由反馈领域集中投影。 */
import {setStreaming} from "../feedback/AgentChat.streamingState";
/** 导出流式状态命令。 */
export {setStreaming};
/** 用途：回滚失败的用户条目；使用范围：旧链路欢迎示例错误处理；解耦评估：条目和 DOM 回滚由响应错误领域集中维护。 */
import {rollbackUserEntry} from "../../stream/response/AgentChat.errorHandling";
/** 导出用户条目回滚命令。 */
export {rollbackUserEntry};

/** 用途：提交欢迎示例；使用范围：示例点击；解耦评估：统一发送门面负责提示词决策、持久化和 adapter 路由。 */
import {sendMessage} from "../../message/sending/AgentChat.send.methods";
/** 导出统一发送命令。 */
export {sendMessage};
