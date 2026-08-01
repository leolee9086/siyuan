/** 用途：转发统一面板挂载入口；使用范围：独立 Agent 延迟运行时；解耦评估：仅在 bootstrap 后加载本目录入口，避免核心提前求值。 */
import {mountAgentPanel} from "../../layout/dock/agent/runtime/AgentPanelController.factory";
/** 导出统一面板挂载入口。 */
export {mountAgentPanel};

/** 用途：转发浏览器能力适配器；使用范围：独立 Agent 延迟运行时；解耦评估：与控制器共享单一动态入口，避免依赖图重复打包。 */
import {createBrowserAgentPanelCapabilities} from "../capabilities.browser.factory";
/** 导出浏览器能力适配器。 */
export {createBrowserAgentPanelCapabilities};
