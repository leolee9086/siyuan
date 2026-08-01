/** 用途：读取当前 MAGI 身份；使用范围：目标策略计算。 */
import {getActiveMagiArmorSession} from "../../../../../../magi/service/magiIdentitySession";
/** 导出 MAGI 身份读取能力。 */
export {getActiveMagiArmorSession};

/** 用途：计算统一面板目标策略；使用范围：目标策略计算。 */
import {resolveAgentPanelTargetPolicy} from "../../../runtime/agentPanel.targetPolicy";
/** 导出统一目标策略计算器。 */
export {resolveAgentPanelTargetPolicy};

/** 用途：约束模型和目标策略读写的聊天状态；使用范围：本目录业务函数。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：读取已初始化配置；使用范围：模型列表重建。 */
import {requireSiyuanConfig} from "../../AgentChat.environment";
/** 导出配置读取函数。 */
export {requireSiyuanConfig};

/** 用途：读取当前语言资源；使用范围：模型与目标文案。 */
import {getAgentChatLanguages} from "../../AgentChat.environment";
/** 导出语言资源读取函数。 */
export {getAgentChatLanguages};

/** 用途：转义模型选项文本；使用范围：模型下拉框渲染。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};
