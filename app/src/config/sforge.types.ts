/**
 * sforge.types.ts - SForge 类型定义
 */

/** 用途：Symbol 键定义。使用范围：ISForgeGlobalState 接口的索引签名键。解耦评估：同目录符号定义，直接导入。 */
import { SForgeSymbols } from "./sforge.symbols";
/** 用途：页签注册表类型。使用范围：全局状态中 DOCK/TAB 注册表映射。解耦评估：父目录类型导入，纯类型引用。 */
import type { TabRegistration } from "../registry/TabRegistry.types";
/** 用途：触发器注册类型。使用范围：全局状态中触发器注册表映射。解耦评估：父目录类型导入，纯类型引用。 */
import type { ITriggerRegistration } from "../registry/TriggerRegistry.types";
/** 用途：刷子会话类型。使用范围：全局状态中格式刷刷子会话。解耦评估：父目录类型导入，纯类型引用。 */
import type { IBrushSession } from "../registry/TriggerRegistry.types";
/** 用途：样式刷子处理器类型。使用范围：全局状态中样式刷子回调处理器。解耦评估：父目录类型导入，纯类型引用。 */
import type { IStyleBrushHandlers } from "../registry/TriggerRegistry.types";
/** 用途：内容渲染器注册类型。使用范围：全局状态中内容渲染器注册表。解耦评估：父目录类型导入，纯类型引用。 */
import type { ContentRendererRegistration } from "../registry/contentRenderer/ContentRendererRegistry.types";
/** 用途：应用实例类型。使用范围：openMobileFileById 函数签名中 App 参数类型。解耦评估：父目录类型导入，纯类型引用。 */
import type { App } from "../index";

/**
 * SForge 全局状态类型定义
 * 
 * 用途：定义 SForge 全局状态的结构
 * 使用场景：在 sforge.global.ts 中用于类型安全的全局状态存取
 * 关联类型：各注册表类型（TabRegistration, ITriggerRegistration 等）
 */
export interface ISForgeGlobalState {
    [SForgeSymbols.DOCK_TYPE_REGISTRY]?: Map<string, TDockPosition>;
    [SForgeSymbols.TAB_TYPE_REGISTRY]?: Map<string, TabRegistration>;
    [SForgeSymbols.TRIGGER_REGISTRY]?: Map<string, ITriggerRegistration>;
    [SForgeSymbols.BRUSH_SESSION]?: IBrushSession | null;
    [SForgeSymbols.STYLE_BRUSH_HANDLERS]?: IStyleBrushHandlers;
    [SForgeSymbols.POPOVER_TARGET_ELEMENT]?: HTMLElement;
    [SForgeSymbols.MODEL_HANDLERS]?: IModelHandlers;
    [SForgeSymbols.OPEN_MOBILE_FILE_BY_ID]?: TOpenMobileFileById;
    [SForgeSymbols.CONTENT_RENDERER_REGISTRY]?: Map<string, ContentRendererRegistration>;
    [SForgeSymbols.REQUEST_SEMAPHORE]?: IRequestSemaphore;
}

/**
 * 请求信号量接口
 *
 * 用途：限制 API 最大并发请求数，防止前端过度发送请求导致后端任务队列堆积
 * 使用场景：fetch.ts 中的 acquire/release 信号量机制
 */
export interface IRequestSemaphore {
    current: number;
    pending: Array<() => void>;
}

/**
 * openMobileFileById 函数签名
 *
 * 用途：通过注册表注入，打断 mobile/editor ↔ plugin/API 循环依赖
 * 使用场景：plugin/API.ts 中暴露给插件的 openMobileFileById 方法
 */
export type TOpenMobileFileById = (app: App, id: string, action?: TProtyleAction[], scrollPosition?: ScrollLogicalPosition) => void;

/**
 * Model WebSocket 处理器接口
 *
 * 用途：通过注册表注入 Model 的运行时依赖，打断 Model ↔ processSystem/processMessage 循环依赖
 * 使用场景：Model.ts 的 WebSocket 回调中调用这些处理器
 */
export interface IModelHandlers {
    processMessage: (response: IWebSocketData) => IWebSocketData | false;
    kernelError: () => void;
    reloadSync: (app: App, data: { upsertRootIDs: string[], removeRootIDs: string[] }) => void;
}

/**
 * 包含 SForge 的全局对象接口（内部使用）
 * 
 * 用途：定义挂载 SForge 全局状态的 globalThis 接口
 * 使用场景：在 sforge.global.ts 中用于类型安全的 globalThis 访问
 */
export interface IGlobalWithSForge {
    [key: symbol]: ISForgeGlobalState;
}

/**
 * S-Forge 初始化选项
 *
 * 用途：定义 initSForge 的配置参数
 * 使用场景：在 sforge.init.ts 中控制初始化行为
 */
export interface ISForgeInitOptions {
    /** 是否为移动端平台 */
    isMobile?: boolean;
}

