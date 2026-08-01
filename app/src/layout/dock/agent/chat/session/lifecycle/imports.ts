/** 用途：约束会话生命周期与 MAGI 历史；使用范围：本目录全部流程；解耦评估：仅导入核心抽象接口和数据类型。 */
import type {
    AgentChatMagiConversationHistory,
    AgentChatRuntime,
    SessionEntry,
} from "../../AgentChat.runtime.types";
/** 导出聊天运行时接口。 */
export type {AgentChatRuntime};
/** 导出统一会话条目类型。 */
export type {SessionEntry};
/** 导出抽象 MAGI 历史类型。 */
export type {AgentChatMagiConversationHistory};

/** 用途：约束删除后的替换候选；使用范围：会话删除；解耦评估：纯类型不加载仓储实现。 */
import type {SessionIndexItem} from "../../../session/AgentSession.types";
/** 导出会话索引项类型。 */
export type {SessionIndexItem};

/** 用途：加载初始会话；使用范围：原生会话初始化；解耦评估：生命周期子域只依赖切换子域公开命令。 */
import {loadSessionForFloating} from "../switching/AgentChat.sessionLoad";
/** 导出浮窗会话加载命令。 */
export {loadSessionForFloating};
/** 用途：切换删除后的替代会话；使用范围：会话删除；解耦评估：切换规则归切换子域所有。 */
import {switchSession} from "../switching/AgentChat.switch";
/** 导出会话切换命令。 */
export {switchSession};

/** 用途：创建新会话前保存旧状态；使用范围：会话创建准备；解耦评估：保存规则归持久化子域所有。 */
import {saveSession} from "../persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};

/** 用途：转义 MAGI 状态文案；使用范围：状态视图 HTML；解耦评估：纯函数是最小安全边界。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
