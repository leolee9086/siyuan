/** 用途：约束镜像占位可写状态；使用范围：本目录显示与移除；解耦评估：仅导入核心抽象接口。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时接口。 */
export type {AgentChatRuntime};

/** 用途：转义镜像提示文案；使用范围：占位 HTML 构建；解耦评估：纯函数是最小安全边界。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
