/**
 * 用途：约束导航轨道读写的聊天状态。
 * 使用范围：仅限本目录导航创建、重建、激活和跳转。
 * 解耦评估：类型导入在编译后消失，不增加运行时依赖。
 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时状态类型。 */
export type {AgentChatRuntime};

/**
 * 用途：转义导航标记的无障碍文案。
 * 使用范围：用户消息导航标记创建。
 * 解耦评估：通用转义函数已经是最小输入边界，无需新增包装。
 */
import {escapeAriaLabel, escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出无障碍文案转义函数。 */
export {escapeAriaLabel};
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/**
 * 用途：收窄导航点击事件目标。
 * 使用范围：仅限导航轨道事件代理。
 * 解耦评估：类型守卫是纯函数，直接复用避免重复平台判断。
 */
import {isHTMLElement} from "../AgentChat.dom.guard";
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};
