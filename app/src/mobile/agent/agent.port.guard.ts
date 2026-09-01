/** 用途：读取移动 Agent 打开能力的纯类型契约；使用范围：注册值运行时收窄；解耦评估：type-only 依赖不加载 Agent 实现，守卫集中在 guard 模块以保持端口低耦合。 */
import type {MobileAgentOpener} from "./agent.port.types";

/** 判断注册值是否符合移动 Agent 打开能力契约。 */
/** @同步豁免: 类型守卫 - 必须在返回前完成函数值收窄，调用方才能安全执行注册能力。 */
export const isMobileAgentOpener = (value: unknown): value is MobileAgentOpener => {
    return typeof value === "function";
};
