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
/** 用途：Model WebSocket 抽象能力；使用范围：全局能力槽；解耦评估：仅包含数据与回调，不依赖 App/Model class。 */
import type { IModelHandlers } from "../layout/modelRegistry/types";
/** 用途：移动文件打开抽象能力；使用范围：全局能力槽；解耦评估：宿主实例由注册闭包绑定，不依赖 App class。 */
import type { IMobileFileOpenPort } from "../plugin/api/openMobileFile.types";
/** 用途：拖拽提示框状态类型。使用范围：SForge 全局状态中拖拽提示状态映射。解耦评估：父目录类型导入，纯类型引用。 */
import type { DragTipState } from "../protyle/util/dragTip.types";
/** 用途：Protyle Dialog 宿主能力；使用范围：全局能力槽；解耦评估：纯 Port 类型，运行时由宿主注入。 */
import type { IProtyleDialogPort } from "../protyle/runtime/dialog.types";
/** 用途：Protyle 状态统计宿主能力；使用范围：全局能力槽；解耦评估：纯 Port 类型，运行时由宿主注入。 */
import type { IProtyleStatusPort } from "../protyle/runtime/status.types";
/** 用途：Protyle 布局宿主能力；使用范围：全局能力槽；解耦评估：纯 Port 类型，运行时由宿主注入。 */
import type { IProtyleLayoutPort } from "../protyle/runtime/layout.types";
/** 用途：为 SForge 全局状态声明页签 Dialog 浮窗宿主能力；使用范围：layout 菜单请求、完整 App 适配器和独立宿主注册；解耦评估：仅为编译期 type-only 依赖，运行时通过 Symbol Port 注入，不能用事件替代状态契约，但不引入 Dialog/Tab 具体实现。 */
import type { ILayoutTabFloatPort } from "../layout/tabFloat.types";
/** 用途：声明 Tab 浮窗副本工厂注册表；使用范围：完整 App 静态能力注册；解耦评估：仅编译期类型依赖。 */
import type { ILayoutTabFloatFactory } from "../layout/tabFloat.types";
/** 用途：声明 Layout 普通 Tab 宿主能力；使用范围：能力注册和菜单请求；解耦评估：仅编译期依赖。 */
import type { ILayoutTabOpenPort } from "../layout/tabOpen.types";
/** 用途：Wnd 拖拽恢复能力。使用范围：全局 Port 类型映射；解耦评估：应用身份参数化，不依赖具体窗口 class。 */
import type { WndDragRestore } from "../layout/layout.types";
/** 用途：应用外观身份。使用范围：Wnd 拖拽恢复 Port 的宿主参数；解耦评估：只读类型依赖，不加载 App 实现。 */
import type { AppFacade } from "../app/AppFacade.types";

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
    [SForgeSymbols.OPEN_MOBILE_FILE_BY_ID]?: IMobileFileOpenPort;
    [SForgeSymbols.CONTENT_RENDERER_REGISTRY]?: Map<string, ContentRendererRegistration>;
    [SForgeSymbols.REQUEST_SEMAPHORE]?: IRequestSemaphore;
    [SForgeSymbols.DRAG_TIP_STATE]?: DragTipState;
    [SForgeSymbols.CARET_LINE_ELEMENT]?: HTMLElement | null;
    [SForgeSymbols.DIALOG_PORT]?: IProtyleDialogPort;
    [SForgeSymbols.STATUS_PORT]?: IProtyleStatusPort;
    [SForgeSymbols.LAYOUT_PORT]?: IProtyleLayoutPort;
    [SForgeSymbols.TAB_FLOAT_PORT]?: ILayoutTabFloatPort;
    [SForgeSymbols.TAB_FLOAT_FACTORY_REGISTRY]?: Map<string, ILayoutTabFloatFactory>;
    [SForgeSymbols.TAB_OPEN_PORT]?: ILayoutTabOpenPort;
    [SForgeSymbols.WND_DRAG_RESTORE]?: WndDragRestore<AppFacade>;
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

