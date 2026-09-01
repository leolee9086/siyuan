/** 用途：约束用户消息函数读写的公开聊天状态；使用范围：本目录全部职责函数。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};
/** 用途：约束可编辑用户条目；使用范围：用户编辑流程。 */
import type {UserEntry} from "../AgentChat.entries.types";
/** 导出用户条目类型。 */
export type {UserEntry};
/** 用途：约束用户条目守卫输入；使用范围：用户编辑流程。 */
import type {SessionEntry} from "../AgentChat.entries.types";
/** 导出会话条目类型。 */
export type {SessionEntry};
/** 用途：约束用户消息可选展示字段；使用范围：消息创建和追加；解耦评估：复用消息领域已经聚合的稳定类型。 */
import type {UserMessageOptions} from "../AgentChat.entries.types";
/** 导出用户消息选项类型。 */
export type {UserMessageOptions};
/** 用途：约束只读用户消息动作生命周期；使用范围：复制、编辑按钮和正文点击；解耦评估：复用消息领域的完整上下文。 */
import type {UserMessageActionContext} from "../AgentChat.entries.types";
/** 导出用户消息动作上下文。 */
export type {UserMessageActionContext};
/** 用途：约束用户编辑控件生命周期；使用范围：取消、提交与键盘处理；解耦评估：复用消息领域的完整上下文。 */
import type {UserEditBindingContext} from "../AgentChat.entries.types";
/** 导出用户编辑绑定上下文。 */
export type {UserEditBindingContext};

/**
 * 用途：关闭已渲染块 DOM 的编辑能力。
 * 使用范围：仅供用户消息富文本渲染完成后调用。
 * 解耦评估：该函数是 Protyle 只读渲染的既有边界，本目录不复制编辑器 DOM 规则。
 */
import {disabledWYSIWYG} from "../../../../../../protyle/util/disabledWYSIWYG";
/** 导出只读 DOM 处理函数。 */
export {disabledWYSIWYG};

/** 用途：执行默认富文本后处理；使用范围：未注入宿主渲染能力时；解耦评估：统一消息渲染器是现有公共边界。 */
import {postRender} from "../../../AgentMessageRenderer";
/** 导出默认富文本后处理函数。 */
export {postRender};

/** 用途：校验事件目标；使用范围：用户正文点击处理；解耦评估：共享 DOM 守卫避免重复断言。 */
import {isHTMLElement} from "../../ui/AgentChat.dom.guard";
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};
/** 用途：读取必备消息元素；使用范围：渲染和编辑控件构建；解耦评估：共享 DOM 守卫统一模板失配错误。 */
import {requireElement} from "../../ui/AgentChat.dom.guard";
/** 导出必备元素读取函数。 */
export {requireElement};

/** 用途：格式化消息时间；使用范围：用户消息动作区；解耦评估：展示格式由反馈领域统一维护。 */
import {formatMessageTime} from "../../ui/feedback/AgentChat.presentation";
/** 导出消息时间格式化函数。 */
export {formatMessageTime};
/** 用途：绑定流式助手卡片尺寸；使用范围：助手占位创建；解耦评估：ResizeObserver 生命周期由滚动领域统一维护。 */
import {observeStickTarget} from "../../ui/feedback/AgentChat.scrolling";
/** 导出流式卡片观察函数。 */
export {observeStickTarget};
/** 用途：维持消息视图贴底；使用范围：用户消息和流式正文更新；解耦评估：滚动意图由反馈领域统一维护。 */
import {scrollToBottom} from "../../ui/feedback/AgentChat.scrolling";
/** 导出消息贴底函数。 */
export {scrollToBottom};
