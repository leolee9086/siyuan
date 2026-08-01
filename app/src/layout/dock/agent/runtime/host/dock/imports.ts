/** 用途：提供 Agent 面板构造器；使用范围：常驻 Dock 模型工厂；解耦评估：本域不加载菜单或其它宿主适配器。 */
import {AgentChat} from "../../../AgentChat";
/** 导出 Agent 面板构造器。 */
export {AgentChat};
/** 用途：提供完整应用宿主能力；使用范围：常驻 Dock 模型工厂；解耦评估：具体 UI 依赖由上层宿主工厂吸收。 */
import {createAppAgentPanelCapabilities} from "../agentPanel.capabilities.app.factory";
/** 导出应用宿主能力工厂。 */
export {createAppAgentPanelCapabilities};
