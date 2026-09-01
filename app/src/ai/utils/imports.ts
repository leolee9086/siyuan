/** 用途：取得旧流式请求控制器所需的配置校验；使用范围：ai/utils 兼容适配器；解耦评估：校验契约由 AI 类型模块集中维护，注入会增加每个调用点的重复参数。 */
import {validateAIConfig} from "../types";
/** 用途：读取内核规范化后的 providers 配置；使用范围：ai/utils 模型解析；解耦评估：全局配置环境是现有应用唯一来源，事件传递无法保证请求前读取最新设置。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 将配置校验按 AI utils 领域导出，避免子模块直接跨层加载。 */
export {validateAIConfig};
/** 将全局配置读取按 AI utils 领域导出，保持唯一依赖入口。 */
export {getSiyuanConfig};
