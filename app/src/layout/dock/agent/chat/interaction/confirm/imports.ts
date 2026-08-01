/**
 * 用途：约束确认流程读写的聊天状态。
 * 使用范围：仅限本目录确认请求、卡片和结果处理。
 * 解耦评估：类型导入在编译后消失，不增加运行时耦合。
 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};

/**
 * 用途：约束确认卡片展示的工具副作用。
 * 使用范围：确认输入和影响列表渲染。
 * 解耦评估：SSE 契约是该数据的事实来源，重复声明会造成协议漂移。
 */
import type {IToolEffects} from "../../../request/sse/agentSSE.types";
/** 导出工具副作用类型。 */
export type {IToolEffects};

/**
 * 用途：持久化确认结果。
 * 使用范围：确认请求成功后的当前会话保存。
 * 解耦评估：会话持久化由运行时端口负责，确认模块不复制存储协议。
 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存函数。 */
export {saveSession};

/**
 * 用途：转义确认卡片中的后端文本。
 * 使用范围：影响列表、工具名称和参数 HTML。
 * 解耦评估：通用转义函数已经是最小安全边界，无需再注入。
 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/**
 * 用途：收窄确认 API 和插件调用结果。
 * 使用范围：确认提交和前端工具结果处理。
 * 解耦评估：守卫是纯数据边界，集中复用可防止解析规则漂移。
 */
import {readAPIResult} from "../AgentChat.api.guard";
import {readPluginActionOutcome} from "./AgentChat.confirm.guard";
/** 导出 API 结果读取函数。 */
export {readAPIResult};
/** 导出插件结果读取函数。 */
export {readPluginActionOutcome};

/** 用途：结束活动思考卡片；使用范围：确认卡片插入前。 */
import {finishActiveThinking} from "../../ui/feedback/AgentChat.thinkingState";
/** 导出思考完成函数。 */
export {finishActiveThinking};
/** 用途：提交当前思考步骤；使用范围：确认卡片插入前。 */
import {flushThinkingStep} from "../../stream/thinking/AgentChat.thinkingStep";
/** 导出思考步骤提交函数。 */
export {flushThinkingStep};
/** 用途：将确认卡片插入助手占位前；使用范围：确认 UI 创建。 */
import {insertBeforeAI} from "../../ui/feedback/AgentChat.messagePlacement";
/** 导出消息插入函数。 */
export {insertBeforeAI};
/** 用途：确认卡片插入后维持消息贴底；使用范围：确认 UI 创建。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底函数。 */
export {scrollToBottom};
/** 用途：生成工具类别文案；使用范围：确认卡片标题。 */
import {toolCategory} from "../../ui/feedback/AgentChat.presentation";
/** 导出工具类别格式函数。 */
export {toolCategory};
/** 用途：渲染工具副作用；使用范围：确认卡片展示。 */
import {renderConfirmEffects} from "../../ui/feedback/AgentChat.presentation";
/** 导出确认效果渲染函数。 */
export {renderConfirmEffects};
