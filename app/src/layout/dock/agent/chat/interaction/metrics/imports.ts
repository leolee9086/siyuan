/** 用途：约束指标与思考历史展示读取的聊天状态；使用范围：本目录全部函数。 */
import type {AgentChatRuntime, ThinkingStep} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};
/** 导出思考步骤契约。 */
export type {ThinkingStep};

/** 用途：构建并后处理思考卡片；使用范围：思考历史展示。 */
import {bindThinkingCardToggle, createThinkingCardElement, postRender} from "../../../AgentMessageRenderer";
/** 导出思考卡片切换绑定。 */
export {bindThinkingCardToggle};
/** 导出思考卡片构建函数。 */
export {createThinkingCardElement};
/** 导出消息后处理函数。 */
export {postRender};

/** 用途：转义令牌和思考详情；使用范围：指标 HTML 构建。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
/** 用途：定位令牌明细；使用范围：弹窗展示。 */
import {setPosition} from "../../../../../../util/DOM/positioning/setPosition";
/** 导出 DOM 定位函数。 */
export {setPosition};
