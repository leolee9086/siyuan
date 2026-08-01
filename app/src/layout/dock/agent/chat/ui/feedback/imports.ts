/**
 * 用途：约束界面反馈函数读写的公开聊天状态。
 * 使用范围：仅供本目录的思考、流式、滚动和展示函数使用。
 * 解耦评估：类型导入在编译后消失，不增加运行时依赖。
 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};
/** 用途：约束确认卡片展示的工具副作用；使用范围：确认影响文案。 */
import type {IToolEffects} from "../../../request/sse/agentSSE.types";
/** 导出工具副作用协议。 */
export type {IToolEffects};

/**
 * 用途：根据当前会话目标计算发送能力。
 * 使用范围：仅供发送按钮状态计算读取，不修改目标状态。
 * 解耦评估：核心策略是纯计算边界，本目录只消费结果，不反向依赖其它界面模块。
 */
import {resolveTargetPolicy} from "../model/AgentChat.targetPolicy";
/** 导出当前目标策略计算函数。 */
export {resolveTargetPolicy};

/**
 * 用途：格式化聊天消息时间。
 * 使用范围：仅供本目录展示格式函数使用。
 * 解耦评估：dayjs 是项目既有时间格式设施，经目录网关集中暴露，避免业务文件直接依赖第三方包。
 */
import * as dayjs from "dayjs";
/** 导出时间格式设施。 */
export {dayjs};
/** 用途：转义确认影响文案；使用范围：确认效果列表。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
