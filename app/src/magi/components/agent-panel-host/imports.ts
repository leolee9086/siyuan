/** 用途：转发 Agent 运行时引导；使用范围：同目录宿主工厂；解耦评估：共享引导实现避免宿主重复加载脚本、样式和环境。 */
import {bootstrapAgentPanelRuntime} from "../../../agent-standalone/bootstrap";
/** 导出共享 Agent 运行时引导。 */
export {bootstrapAgentPanelRuntime};

/** 用途：转发浏览器宿主能力工厂；使用范围：MAGI 独立入口；解耦评估：细粒度 capability 组合由适配器集中提供。 */
import {createBrowserAgentPanelCapabilities} from "../../../agent-standalone/capabilities.browser";
/** 导出浏览器宿主能力工厂。 */
export {createBrowserAgentPanelCapabilities};

/** 用途：转发统一面板挂载入口；使用范围：MAGI CHAT 宿主；解耦评估：DOM、会话和 capability 参数构成稳定边界。 */
import {mountAgentPanel} from "../../../layout/dock/agent/runtime/AgentPanelController";
/** 导出统一面板挂载入口。 */
export {mountAgentPanel};

/** 用途：转发面板句柄类型；使用范围：宿主内部生命周期状态；解耦评估：纯类型依赖在运行时消除。 */
import type {AgentPanelHandle} from "../../../layout/dock/agent/runtime/agentPanel.ports.types";
/** 导出面板句柄类型。 */
export type {AgentPanelHandle};

/** 用途：转发身份头像草稿事件名；使用范围：身份页到 CHAT Composer；解耦评估：事件契约避免跨组件引用。 */
import {MAGI_WRITE_AVATAR_EVENT} from "../../service/magiIdentitySession";
/** 导出身份头像草稿事件名。 */
export {MAGI_WRITE_AVATAR_EVENT};
