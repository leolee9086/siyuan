/** 用途：约束切换流程可写状态；使用范围：本目录全部流程；解耦评估：仅导入核心抽象接口，不加载 AgentChat class。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时接口。 */
export type {AgentChatRuntime};

/** 用途：约束切换目标会话；使用范围：切换与浮窗加载；解耦评估：纯类型不加载仓储实现。 */
import type {AgentSession} from "../../../session/AgentSession.types";
/** 导出持久化会话类型。 */
export type {AgentSession};

/** 用途：恢复中断轮次；使用范围：切换后和跨实例更新后；解耦评估：切换子域只依赖持久化子域的公开命令。 */
import {recoverInterruptedTurn} from "../persistence/AgentChat.recoverTurn";
/** 导出中断轮次恢复命令。 */
export {recoverInterruptedTurn};
/** 用途：读取权威会话更新；使用范围：跨实例通知；解耦评估：重载规则归持久化子域所有。 */
import {reloadFromDisk} from "../persistence/AgentChat.reload";
/** 导出权威会话重载命令。 */
export {reloadFromDisk};
/** 用途：离开当前会话前持久化；使用范围：无活跃轮次的切换；解耦评估：保存规则归持久化子域所有。 */
import {saveSession} from "../persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};
