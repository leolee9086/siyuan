// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/** 用途：标注 native handler 的应用实例参数。使用范围：registry 调度平台根 handler 时。解耦评估：仅类型依赖，不加载 App 组合根。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：读取 Agent capability 声明。使用范围：registry API 与 native handler 类型。解耦评估：类型 owner 不加载 UI 实现。 */
import type {IAgentCapability} from "./runtime/public/frontendCapabilities.types";
/** 用途：读取 capability 风险声明。使用范围：保持 registry 对外类型 API。解耦评估：类型 owner 不加载 UI 实现。 */
import type {IAgentCapabilityEffects} from "./runtime/public/frontendCapabilities.types";
/** 用途：读取可序列化 capability 清单类型。使用范围：registry API 与内核协议。解耦评估：类型 owner 不加载 UI 实现。 */
import type {IAgentCapabilityManifest} from "./runtime/public/frontendCapabilities.types";
/** 用途：读取页面级 capability registry 容器类型。使用范围：HMR 稳定全局槽的读写。解耦评估：类型 owner 不加载 UI 实现。 */
import type {TAgentCapabilityRegistry} from "./runtime/public/frontendCapabilities.types";

/** 用途：向既有消费者保留 capability 风险类型入口。使用范围：Agent registry public API。 */
export type {IAgentCapabilityEffects};
/** 用途：向既有消费者保留 capability 类型入口。使用范围：Agent registry public API。 */
export type {IAgentCapability};
/** 用途：向既有消费者保留 capability 清单类型入口。使用范围：Agent registry public API。 */
export type {IAgentCapabilityManifest};

/**
 * 作用：识别当前 native capability 所在的移动浏览器 bundle。
 * 意图：registry 必须选择平台专属全局 handler，但不能依赖高扇出 Agent imports 网关。
 * 调用时机：模块初始化和每次 native capability 调度时。
 * 问题/改进：检测与平台模块一致地优先排除 Electron，再识别移动壳的 sidebar。
 * @同步豁免: 生命周期
 * bundle 身份在页面生命周期内不变，异步检测会延后 capability 注册。
 */
const detectNativeCapabilityMobilePlatform = () => {
    if (navigator.userAgent.startsWith("SiYuan/")) {
        return false;
    }
    return document.getElementById("sidebar") !== null;
};

// 浏览器能力只在当前应用实例中执行，内核持有声明和本轮不可变的调用映射。

/** HMR 稳定的 capability registry 全局槽。 */
const capabilityRegistryKey = Symbol.for("sforge.agent.frontendCapabilities.registry");
/** HMR 稳定的 capability generation 全局槽。 */
const capabilityGenerationKey = Symbol.for("sforge.agent.frontendCapabilities.generation");

/**
 * 作用：读取或初始化页面级 capability registry。
 * 意图：让 HMR 后的新模块继续使用同一个 registry，避免模块级可变状态分裂。
 * 调用时机：注册、查询、列举和撤销 capability 时。
 * @同步豁免: 生命周期
 * registry 必须在当前调用中可见，异步初始化会使 capability 生命周期出现空窗。
 */
const getCapabilityRegistry = () => {
    const registeredRegistry: TAgentCapabilityRegistry | undefined = Reflect.get(globalThis, capabilityRegistryKey);
    if (registeredRegistry && typeof registeredRegistry === "object") {
        return registeredRegistry;
    }
    const registry: TAgentCapabilityRegistry = Object.create(null);
    const didRegister = Reflect.set(globalThis, capabilityRegistryKey, registry);
    if (!didRegister) {
        throw new Error("Unable to initialize agent capability registry");
    }
    return registry;
};

/**
 * 作用：递增并记录 capability generation。
 * 意图：让同一 ID 的新 handler 能够拒绝旧异步调用。
 * 调用时机：每次 registerCapability 写入 registry 前。
 * @同步豁免: 生命周期
 * generation 必须与对应 registry 写入处于同一同步临界区。
 */
const getNextCapabilityGeneration = () => {
    const currentGeneration = Reflect.get(globalThis, capabilityGenerationKey);
    const nextGeneration = typeof currentGeneration === "number" ? currentGeneration + 1 : 1;
    const didRegister = Reflect.set(globalThis, capabilityGenerationKey, nextGeneration);
    if (!didRegister) {
        throw new Error("Unable to update agent capability generation");
    }
    return nextGeneration;
};

/**
 * 作用：登记或更新指定 ID 的 capability，并分配新的代际编号。
 * 意图：使热更新后的调用能够拒绝旧 generation。
 * 调用时机：原生 UI 与插件完成能力装配时。
 * 问题/改进：注册表仅在当前页面进程内持久化。
 * @同步豁免: 生命周期
 * generation 必须在注册调用返回前确定，供同轮卸载和热更新精确匹配。
 */
export const registerCapability = (capability: IAgentCapability) => {
    const generation = getNextCapabilityGeneration();
    const didRegister = Reflect.set(getCapabilityRegistry(), capability.id, {...capability, generation});
    if (!didRegister) {
        throw new Error(`Unable to register agent capability: ${capability.id}`);
    }
    return generation;
};

/**
 * 作用：按 ID 和可选 generation 查询当前 capability。
 * 意图：防止异步 Agent 调用落到已被热更新替换的旧 handler。
 * 调用时机：执行 capability 请求前。
 * 问题/改进：未登记或 generation 不匹配时返回 undefined。
 * @显式返回类型原因：调用方需要稳定地区分当前 registry 条目与缺失状态。
 * @同步豁免: 生命周期
 * Agent 请求必须在同一代际内读取当前 handler，不能等待异步状态刷新。
 */
export const lookupCapability = (id: string, generation?: number): IAgentCapability | undefined => {
    const capability = Reflect.get(getCapabilityRegistry(), id);
    if (!capability || generation !== undefined && capability.generation !== generation) {
        return undefined;
    }
    return capability;
};

/**
 * 作用：判断 capability 是否被当前 AI 策略允许。
 * 意图：在执行前应用用户设置的默认策略与逐项覆盖。
 * 调用时机：Agent 选择或调用本地 capability 时。
 * 问题/改进：配置不存在时兼容旧配置并默认允许。
 * @显式返回类型原因：策略调用方只接受稳定的布尔结果。
 * @同步豁免: 性能考虑
 * 配置对象已驻留在当前页面，异步化会在 capability 执行前引入无收益的竞态。
 */
export const isCapabilityEnabled = (id: string): boolean => {
    const policy = window.siyuan.config?.ai.agent.capabilityPolicy;
    if (!policy) {
        return true;
    }
    return (policy.overrides[id] || policy.default) === "allow";
};

/**
 * 作用：剥离 capability 的执行闭包，构造可序列化的元数据快照。
 * 意图：确保传给内核的 manifest 不携带浏览器函数引用。
 * 调用时机：listCapabilityManifests 遍历当前 registry 时。
 * @同步豁免: 性能考虑，清单投影必须在读取 registry 的同一时刻完成。
 */
const toCapabilityManifest = (capability: IAgentCapabilityManifest & Pick<IAgentCapability, "handler">) => ({
    id: capability.id,
    description: capability.description,
    inputSchema: capability.inputSchema,
    source: capability.source,
    generation: capability.generation,
    ...(capability.title !== undefined ? {title: capability.title} : {}),
    ...(capability.outputSchema !== undefined ? {outputSchema: capability.outputSchema} : {}),
    ...(capability.effects !== undefined ? {effects: capability.effects} : {}),
    ...(capability.actionEffects !== undefined ? {actionEffects: capability.actionEffects} : {}),
    ...(capability.ownerId !== undefined ? {ownerId: capability.ownerId} : {}),
    ...(capability.ownerName !== undefined ? {ownerName: capability.ownerName} : {}),
});

/**
 * 作用：返回可安全发给内核或诊断 UI 的 capability 元数据副本。
 * 意图：隔离不可序列化的 handler 闭包。
 * 调用时机：建立 Agent 会话或刷新 capability 清单时。
 * 问题/改进：每次调用都会创建快照，调用方不应长期持有后再执行。
 * @显式返回类型原因：外部协议需要稳定的 manifest 数组边界。
 * @同步豁免: 生命周期
 * 会话初始化必须在发送请求前获取同一时刻的完整 registry 快照。
 */
export const listCapabilityManifests = (): IAgentCapabilityManifest[] => Object.values(getCapabilityRegistry()).map(toCapabilityManifest);

/**
 * 作用：移除 capability，必要时只移除指定 generation。
 * 意图：避免插件热更新或卸载时误删后续版本的 handler。
 * 调用时机：插件撤销自身 capability，或原生能力完成替换时。
 * 问题/改进：不存在的 ID 视为已完成，无额外错误。
 * @同步豁免: 生命周期
 * 删除必须在卸载回调返回前生效，避免旧 generation 在同轮继续可见。
 */
export const unregisterCapability = (id: string, generation?: number) => {
    const capability = Reflect.get(getCapabilityRegistry(), id);
    if (generation !== undefined && capability?.generation !== generation) {
        return;
    }
    Reflect.deleteProperty(getCapabilityRegistry(), id);
};

/**
 * 作用：调用当前平台组合根注册的 native capability handler。
 * 意图：Agent registry 不反向导入配置、编辑器、搜索或移动 UI owner，避免恢复循环依赖。
 * 调用时机：所有 `native/frontend/*` capability 被 Agent 运行时调用时。
 * 问题/改进：根组合尚未初始化时返回明确错误，调用方可在应用完成启动后重试。
 */
const runNativeFrontendCapability = async (capabilityID: string, args: Record<string, unknown>, app: AppFacade) => {
    const handlerKey = detectNativeCapabilityMobilePlatform() ?
        Symbol.for("sforge.agent.frontendCapabilities.mobileHandler") :
        Symbol.for("sforge.agent.frontendCapabilities.desktopHandler");
    const handler = Reflect.get(globalThis, handlerKey);
    if (typeof handler !== "function") {
        return {error: "Native frontend capability handler is not available yet."};
    }
    return handler(capabilityID, args, app);
};

/**
 * 作用：转发设置 capability。
 * 意图：捕获稳定 capability ID 后复用平台根的静态 handler。
 * 调用时机：Agent 调用 open_setting。
 * 问题/改进：根未就绪时返回可重试错误。
 */
// @柯里化
const nativeOpenSettingHandler: IAgentCapability["handler"] = (args, app) => runNativeFrontendCapability("native/frontend/open_setting", args, app);

/**
 * 作用：转发块聚焦 capability。
 * 意图：捕获稳定 capability ID 后复用平台根的静态 handler。
 * 调用时机：Agent 调用 focus_block。
 * 问题/改进：根未就绪时返回可重试错误。
 */
// @柯里化
const nativeFocusBlockHandler: IAgentCapability["handler"] = (args, app) => runNativeFrontendCapability("native/frontend/focus_block", args, app);

/**
 * 作用：转发文档打开 capability。
 * 意图：捕获稳定 capability ID 后复用平台根的静态 handler。
 * 调用时机：Agent 调用 open_document。
 * 问题/改进：根未就绪时返回可重试错误。
 */
// @柯里化
const nativeOpenDocumentHandler: IAgentCapability["handler"] = (args, app) => runNativeFrontendCapability("native/frontend/open_document", args, app);

/**
 * 作用：转发搜索 capability。
 * 意图：捕获稳定 capability ID 后复用平台根的静态 handler。
 * 调用时机：Agent 调用 open_search。
 * 问题/改进：根未就绪时返回可重试错误。
 */
// @柯里化
const nativeOpenSearchHandler: IAgentCapability["handler"] = (args, app) => runNativeFrontendCapability("native/frontend/open_search", args, app);

// 非移动 bundle 只声明桌面 UI 能力，调用仍在执行时依据平台根 handler 解析。
if (!detectNativeCapabilityMobilePlatform()) {
    registerCapability({
        id: "native/frontend/open_setting",
        title: "Open settings",
        description: "Open SiYuan settings and optionally filter settings by a search query.",
        inputSchema: {type: "object", properties: {query: {type: "string"}}, additionalProperties: false},
        source: "native",
        handler: nativeOpenSettingHandler,
    });

    registerCapability({
        id: "native/frontend/focus_block",
        title: "Focus block",
        description: "Scroll a block already loaded in an editor into view and highlight it.",
        inputSchema: {type: "object", properties: {id: {type: "string"}}, required: ["id"], additionalProperties: false},
        source: "native",
        handler: nativeFocusBlockHandler,
    });

    registerCapability({
        id: "native/frontend/open_document",
        title: "Open document",
        description: "Open a SiYuan document by its block ID in the current app.",
        inputSchema: {type: "object", properties: {id: {type: "string"}}, required: ["id"], additionalProperties: false},
        source: "native",
        handler: nativeOpenDocumentHandler,
    });

    registerCapability({
        id: "native/frontend/open_search",
        title: "Open search",
        description: "Open the SiYuan search interface and optionally fill in a query.",
        inputSchema: {type: "object", properties: {query: {type: "string"}}, additionalProperties: false},
        source: "native",
        handler: nativeOpenSearchHandler,
    });
}

// 移动 bundle 只声明移动 UI 能力，避免桌面描述和操作出现在移动 Agent capability 清单中。
if (detectNativeCapabilityMobilePlatform()) {
    registerCapability({
        id: "native/frontend/open_setting",
        title: "Open settings",
        description: "Open SiYuan settings and optionally provide a search query.",
        inputSchema: {type: "object", properties: {query: {type: "string"}}, additionalProperties: false},
        source: "native",
        handler: nativeOpenSettingHandler,
    });

    registerCapability({
        id: "native/frontend/focus_block",
        title: "Focus block",
        description: "Scroll a block already loaded in the current editor into view and highlight it.",
        inputSchema: {type: "object", properties: {id: {type: "string"}}, required: ["id"], additionalProperties: false},
        source: "native",
        handler: nativeFocusBlockHandler,
    });

    registerCapability({
        id: "native/frontend/open_document",
        title: "Open document",
        description: "Open a SiYuan document by its block ID in the mobile app.",
        inputSchema: {type: "object", properties: {id: {type: "string"}}, required: ["id"], additionalProperties: false},
        source: "native",
        handler: nativeOpenDocumentHandler,
    });

    registerCapability({
        id: "native/frontend/open_search",
        title: "Open search",
        description: "Open the SiYuan mobile search interface and optionally fill in a query.",
        inputSchema: {type: "object", properties: {query: {type: "string"}}, additionalProperties: false},
        source: "native",
        handler: nativeOpenSearchHandler,
    });
}
