/** 用途：约束 capability handler 的应用参数。使用范围：公开 registry 类型。解耦评估：纯类型依赖，不加载 App 组合根。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";

/**
 * 用途：声明 capability 可能影响的本地数据、外发数据和成本类别。
 * 使用场景：内核在调用前展示确认或依策略授权时读取。
 * 关联类型：IAgentCapability、IAgentCapabilityManifest。
 * 问题/改进：该结构只描述风险，不替代实际的运行时权限检查。
 */
export interface IAgentCapabilityEffects {
    localRead?: boolean;
    localWrite?: boolean;
    dataEgress?: boolean;
    externalCost?: boolean;
}

/**
 * 用途：定义 Agent 可调用的前端能力及其参数、风险和执行函数。
 * 使用场景：原生 UI 与插件向当前会话的 capability registry 注册时。
 * 关联类型：IAgentCapabilityEffects、IAgentCapabilityManifest、AppFacade。
 * 问题/改进：handler 只应持有低层协议，不应静态反向导入应用组合根。
 */
export interface IAgentCapability {
    id: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    effects?: IAgentCapabilityEffects;
    actionEffects?: Record<string, IAgentCapabilityEffects>;
    source: "native" | "plugin";
    ownerId?: string;
    ownerName?: string;
    generation?: number;
    handler: (args: Record<string, unknown>, app: AppFacade) => Promise<{
        result?: string;
        structuredContent?: unknown;
        error?: string;
    }>;
}

/**
 * 用途：暴露不含执行闭包的 capability 元数据快照。
 * 使用场景：发送到内核、诊断 UI 和策略校验时。
 * 关联类型：IAgentCapability、IAgentCapabilityEffects。
 * 问题/改进：generation 仅在当前浏览器会话内单调递增。
 */
export type IAgentCapabilityManifest = Omit<IAgentCapability, "handler"> & {generation: number};

/**
 * 用途：表示按 capability ID 保存当前 handler 与元数据的 registry。
 * 使用场景：frontendCapabilities 使用 HMR 稳定全局槽读写能力。
 * 关联类型：IAgentCapability、IAgentCapabilityManifest。
 * 问题/改进：registry 是页面级状态，不应序列化或跨窗口共享。
 */
export type TAgentCapabilityRegistry = Record<string, IAgentCapabilityManifest & Pick<IAgentCapability, "handler">>;
