/** 用途：描述 capability 调用方的稳定应用外观，不加载应用组合根。 */
import type {AppFacade} from "../../../../../app/AppFacade.types";

/** capability handler 读取的最小编辑器 DOM 外观。 */
type TNativeEditor = {protyle: {wysiwyg: {element: HTMLElement}}};

/** 桌面设置页签调用所需的最小参数类型。 */
type TSettingTab =
    | "editor" | "file" | "appearance" | "bazaar" | "flashcard" | "ai" | "AIProfiles"
    | "secretsVariables" | "assets" | "export" | "search" | "keymap" | "sync" | "access" | "app" | "about";

/** 用途：桌面 capability factory 的组合根依赖。使用范围：桌面 App 启动时注册 native handler。关联类型：AppFacade。 */
export type TDesktopNativeCapabilityEffects = {
    constants: {CB_GET_FOCUS: TProtyleAction; DIALOG_GLOBALSEARCH: string},
    getAllEditor: () => TNativeEditor[],
    openFileById: (options: {app: AppFacade; id: string; action?: TProtyleAction[]}) => Promise<unknown> | unknown,
    openSearch: (options: {app: AppFacade; hotkey: string; key?: string}) => Promise<unknown> | unknown,
    openSetting: (app: AppFacade) => {element: HTMLElement} | undefined,
};

/** 用途：移动 capability factory 的组合根依赖。使用范围：移动 App 启动时注册 native handler。 */
export type TMobileNativeCapabilityEffects = {
    constants: {CB_GET_FOCUS: TProtyleAction},
    getCurrentEditor: () => TNativeEditor | undefined,
    hideMobileAgent: () => void,
    openMobileFileById: (app: AppFacade, id: string, action?: TProtyleAction[]) => void,
    openMobileSetting: (app: AppFacade, tab?: TSettingTab, returnCallback?: () => void) => void,
    popSearch: (app: AppFacade, searchConfig?: Config.IUILayoutTabSearchConfig) => void,
    reopenMobileAgent: () => void,
};

/** 用途：标记 capability factory 与调用方共享的 App 参数。使用范围：文档、搜索与设置 owner 的函数契约。关联类型：TDesktopNativeCapabilityEffects、TMobileNativeCapabilityEffects。 */
export type TNativeCapabilityApp = AppFacade;
