/**
 * sforge.types.ts - SForge 类型定义
 */

/** 用途：Symbol 键定义。使用范围：ISForgeGlobalState 接口的索引签名键。解耦评估：同目录符号定义，直接导入。 */
import {AV_VIRTUAL_SCROLL_REGISTRY} from "./sforge.symbols";
/** 用途：定位 AV 条目定位注册状态。使用范围：ISForgeGlobalState 的定位生命周期槽。解耦评估：Symbol 保证跨渲染与导航调用共享唯一状态。 */
import {AV_LOCATE_REGISTRY} from "./sforge.symbols";
/** 用途：定位布局持久化注册状态。使用范围：ISForgeGlobalState 的布局保存状态槽。解耦评估：Symbol 是跨模块共享注册状态的稳定身份，参数传递会破坏全局唯一性。 */
import {LAYOUT_PERSISTENCE_REGISTRY} from "./sforge.symbols";
/** 用途：定位移动键盘生命周期状态。使用范围：ISForgeGlobalState 的移动键盘状态槽。解耦评估：Symbol 是跨调用生命周期状态的稳定身份，不应通过调用链逐层传递。 */
import {MOBILE_KEYBOARD_LIFECYCLE_REGISTRY} from "./sforge.symbols";
/** 用途：定位导航历史注册表。使用范围：ISForgeGlobalState 的桌面与移动导航状态槽。解耦评估：Symbol 保证注册表身份唯一，事件或局部参数不能替代状态所有权。 */
import {NAVIGATION_HISTORY_REGISTRY} from "./sforge.symbols";
/** 用途：定位窗口键盘切换对话框状态。使用范围：ISForgeGlobalState 的当前对话框槽；解耦评估：Symbol 保证跨 state/subset 调用共享同一生命周期状态。 */
import {WINDOW_KEYDOWN_SWITCH_DIALOG} from "./sforge.symbols";
/** 用途：定位当前搜索文章预览；使用范围：ISForgeGlobalState 的异步预览隔离槽；解耦评估：Symbol 保证跨调用共享唯一状态。 */
import {ARTICLE_PREVIEW_CURRENT_ID} from "./sforge.symbols";
/** 用途：定位 Model WebSocket 处理器。使用范围：ISForgeGlobalState 的模型消息能力槽；解耦评估：命名 Symbol 保留键和值的精确映射。 */
import {MODEL_HANDLERS} from "./sforge.symbols";
/** 用途：定位网络请求信号量。使用范围：ISForgeGlobalState 的并发控制状态槽；解耦评估：命名 Symbol 保留键和值的精确映射。 */
import {REQUEST_SEMAPHORE} from "./sforge.symbols";
/** 用途：定位内核消息分发 UI 依赖。使用范围：ISForgeGlobalState 的网络消息能力槽；解耦评估：命名 Symbol 保证各网络入口读取同一宿主能力。 */
import {PROCESS_MESSAGE_UI_DEPENDENCIES} from "./sforge.symbols";
/** 用途：定位新用户引导生命周期状态；使用范围：ISForgeGlobalState 的登录/同步监听槽；解耦评估：Symbol 保证跨事件回调共享唯一状态。 */
import {ONBOARDING_LIFECYCLE_STATE} from "./sforge.symbols";
/** 用途：定位通用全局命令路由；使用范围：ISForgeGlobalState 的命令分发槽；解耦评估：Symbol 保证 HMR 与多入口共享唯一已构建路由。 */
import {COMMON_GLOBAL_COMMAND_ROUTER} from "./sforge.symbols";
/** 用途：定位 Agent 前端动作注册状态；使用范围：ISForgeGlobalState 的插件与内建动作槽；解耦评估：Symbol 保证跨插件和面板实例共享唯一注册表。 */
import {FRONTEND_ACTION_REGISTRY} from "./sforge.symbols";
/** 用途：定位布局重排防抖状态；使用范围：ISForgeGlobalState 的重排调度槽；解耦评估：Symbol 保证所有 Wnd/Dock 调用共享同一调度状态。 */
import {LAYOUT_RESIZE_REGISTRY} from "./sforge.symbols";
/** 用途：定位设置页签完整注册表。使用范围：设置运行时重挂载；解耦评估：仅保存完整 SettingTab 领域对象，不加载设置装配实现。 */
import {SETTING_TAB_REGISTRY} from "./sforge.symbols";
/** 用途：定位 Forge Runtime 主界面控制器。使用范围：源码热更新入口生命周期。解耦评估：Symbol 保证主界面只创建一个状态根。 */
import {FORGE_RUNTIME_CONTROL} from "./sforge.symbols";
/** 用途：提供通用 SForge 状态键集合。使用范围：ISForgeGlobalState 中尚未独立导出的 Symbol 索引。解耦评估：本文件定义全局状态映射，必须直接依赖其键声明。 */
import {SForgeSymbols} from "./sforge.symbols";
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
/** 用途：声明当前切换对话框完整生命周期。使用范围：窗口键盘状态槽；解耦评估：纯类型依赖不加载具体 Dialog class。 */
import type {IProtyleDialog} from "../protyle/runtime/dialog.types";
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
/** 用途：布局持久化注册状态。使用范围：全局状态键值映射；解耦评估：纯数据类型，不加载保存实现。 */
import type {LayoutPersistenceState} from "../layout/persistence/state/saveLayout.types";
/** 用途：完整导航历史注册表键值类型。使用范围：SForge 全局状态映射；解耦评估：纯类型依赖只建立注册表协议，不加载桌面或移动导航实现。 */
import type {NavigationHistoryScope} from "../navigation/history/NavigationHistory.types";
/** 用途：完整导航历史状态值类型。使用范围：SForge 全局状态映射；解耦评估：纯类型依赖直接指向状态声明，不加载导航行为实现。 */
import type {NavigationHistoryState} from "../navigation/history/NavigationHistory.types";
/** 用途：完整移动键盘生命周期状态。使用范围：SForge 全局状态映射；解耦评估：纯类型依赖不加载工具栏实现。 */
import type {MobileKeyboardLifecycleState} from "../mobile/keyboard/MobileKeyboardLifecycle.types";
/** 用途：完整 AV 虚拟滚动注册状态。使用范围：SForge 全局状态映射；解耦评估：纯数据类型不加载行渲染或裁剪实现。 */
import type {AVVirtualScrollRegistryState} from "../protyle/render/av/virtualScroll/virtualScroll.types";
/** 用途：完整 AV 定位注册状态。使用范围：SForge 全局状态映射；解耦评估：纯数据类型不加载定位或渲染实现。 */
import type {AVLocateRegistryState} from "../protyle/render/av/locate/locate.types";
/** 用途：完整引导生命周期状态；使用范围：SForge 全局状态映射；解耦评估：纯事件处理器数据，不加载引导 UI。 */
import type {OnboardingLifecycleState} from "../onboarding/lifecycle/state.types";
/** 用途：通用全局命令路由完整类型；使用范围：SForge 全局状态映射；解耦评估：纯命令领域类型不加载路由实现。 */
import type {CommonGlobalCommandRouter} from "../boot/globalEvent/command/global/types";
/** 用途：完整前端动作注册状态；使用范围：SForge 全局状态映射；解耦评估：纯类型不加载动作实现。 */
import type {FrontendActionRegistryState} from "../layout/dock/agent/frontendActions/types";
/** 用途：布局重排完整调度状态；使用范围：SForge 全局状态映射；解耦评估：纯数据类型不加载布局或编辑器实现。 */
import type {LayoutResizeState} from "../layout/resize/resizeTabs.types";
/** 用途：完整设置页签领域对象。使用范围：SForge 注册表映射；解耦评估：纯类型依赖，不加载 tabs.ts 注册装配。 */
import type {SettingTab} from "../config/setting/builder";
/** 用途：内核消息分发完整 UI 依赖。使用范围：全局能力槽；解耦评估：纯类型依赖不加载网络或 Dialog 实现。 */
import type {IProcessMessageUIDependencies} from "../util/network/types";
/** 用途：Forge Runtime 完整控制领域根。使用范围：全局状态映射。解耦评估：纯类型引用，不加载控制器实现。 */
import type {ForgeRuntimeControl} from "../sforge/forgeRuntime";

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
    [MODEL_HANDLERS]?: IModelHandlers;
    [SForgeSymbols.OPEN_MOBILE_FILE_BY_ID]?: IMobileFileOpenPort;
    [SForgeSymbols.CONTENT_RENDERER_REGISTRY]?: Map<string, ContentRendererRegistration>;
    [REQUEST_SEMAPHORE]?: IRequestSemaphore;
    [PROCESS_MESSAGE_UI_DEPENDENCIES]?: IProcessMessageUIDependencies;
    [SForgeSymbols.DRAG_TIP_STATE]?: DragTipState;
    [SForgeSymbols.CARET_LINE_ELEMENT]?: HTMLElement | null;
    [SForgeSymbols.DIALOG_PORT]?: IProtyleDialogPort;
    [SForgeSymbols.STATUS_PORT]?: IProtyleStatusPort;
    [SForgeSymbols.LAYOUT_PORT]?: IProtyleLayoutPort;
    [SForgeSymbols.TAB_FLOAT_PORT]?: ILayoutTabFloatPort;
    [SForgeSymbols.TAB_FLOAT_FACTORY_REGISTRY]?: Map<string, ILayoutTabFloatFactory>;
    [SForgeSymbols.TAB_OPEN_PORT]?: ILayoutTabOpenPort;
    [SForgeSymbols.WND_DRAG_RESTORE]?: WndDragRestore<AppFacade>;
    [NAVIGATION_HISTORY_REGISTRY]?: Map<NavigationHistoryScope, NavigationHistoryState>;
    [MOBILE_KEYBOARD_LIFECYCLE_REGISTRY]?: MobileKeyboardLifecycleState;
    [LAYOUT_PERSISTENCE_REGISTRY]?: Map<string, LayoutPersistenceState>;
    [AV_VIRTUAL_SCROLL_REGISTRY]?: AVVirtualScrollRegistryState;
    [AV_LOCATE_REGISTRY]?: AVLocateRegistryState;
    [WINDOW_KEYDOWN_SWITCH_DIALOG]?: IProtyleDialog;
    [ARTICLE_PREVIEW_CURRENT_ID]?: string;
    [ONBOARDING_LIFECYCLE_STATE]?: OnboardingLifecycleState;
    [COMMON_GLOBAL_COMMAND_ROUTER]?: CommonGlobalCommandRouter<AppFacade>;
    [FRONTEND_ACTION_REGISTRY]?: FrontendActionRegistryState;
    [LAYOUT_RESIZE_REGISTRY]?: LayoutResizeState;
    [SETTING_TAB_REGISTRY]?: Map<string, SettingTab>;
    [FORGE_RUNTIME_CONTROL]?: ForgeRuntimeControl;
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
