/** 用途：获取统一面板挂载入口；使用范围：独立 Agent bootstrap 后挂载；解耦评估：经本目录网关延迟加载核心。 */
import {mountAgentPanel} from "./imports";
/** 导出统一面板挂载入口。 */
export {mountAgentPanel};

/** 用途：获取浏览器能力适配器；使用范围：独立 Agent bootstrap 后能力组合；解耦评估：经本目录网关与控制器同 chunk 加载。 */
import {createBrowserAgentPanelCapabilities} from "./imports";
/** 导出浏览器能力适配器。 */
export {createBrowserAgentPanelCapabilities};
