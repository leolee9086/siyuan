/**
 * 用途：统一收集窗口级键盘事件在路由前需要的全部显式事实。
 * 使用范围：仅供 `windowKeyDown.ts` 在进入路由阶段前调用一次。
 * 解耦评估：当前目录只负责“发生了什么”的收集，不负责命令归并或子路由选择，因此不会把收集阶段退化成隐藏的路由前置层。
 */

/**
 * 用途：引入 Dialog 类型定义，用于描述思源对话框的结构。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 */
import type { Dialog } from "./imports";

/**
 * 用途：引入 PluginCommandMatch 类型，用于标注插件命令匹配结果的结构。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 */
import type { PluginCommandMatch } from "./imports";

/**
 * 用途：引入 SpecialDialogType 联合类型，用于区分特殊对话框的具体子类型。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 */
import type { SpecialDialogType } from "./imports";

/**
 * 用途：引入 WindowKeyDownState 聚合状态类型，定义状态收集阶段输出的完整形状。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 */
import type { WindowKeyDownState } from "./imports";

/**
 * 用途：引入 Constants 常量枚举，用于对话框 data-key 属性值的引用比较。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合常量定义模块。
 */
import { Constants } from "./imports";

/**
 * 用途：引入 getAllDocks 函数，用于遍历所有停靠栏组件以匹配快捷键。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合停靠栏模块。
 */
import { getAllDocks } from "./imports";

/**
 * 用途：引入 getSafeSiyuanConfig 函数，用于安全读取思源配置。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合配置模块。
 */
import { getSafeSiyuanConfig } from "./imports";

/**
 * 用途：引入 getSiyuanDialogs 函数，用于获取当前所有已打开的对话框列表。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合对话框管理模块。
 */
import { getSiyuanDialogs } from "./imports";

/**
 * 用途：引入 getSiyuanMenus 函数，用于获取当前菜单实例以检测菜单可见性。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合菜单模块。
 */
import { getSiyuanMenus } from "./imports";

/**
 * 用途：引入 hasClosestByClassName 函数，用于检测目标元素是否在指定 class 的祖先内。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合 DOM 工具模块。
 */
import { hasClosestByClassName } from "./imports";

/**
 * 用途：引入 isElectron 常量，用于判断当前运行环境是否为 Electron。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合环境检测模块。
 */
import { isElectron } from "./imports";

/**
 * 用途：引入 isNotCtrl 函数，用于检测事件是否不包含 Ctrl 修饰键。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合键盘工具模块。
 */
import { isNotCtrl } from "./imports";

/**
 * 用途：引入 isWindow 函数，用于检测当前是否为独立窗口模式。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合窗口检测模块。
 */
import { isWindow } from "./imports";

/**
 * 用途：引入 matchAuxiliaryHotKey 函数，用于检测辅助快捷键匹配（如组合键）。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合快捷键匹配模块。
 */
import { matchAuxiliaryHotKey } from "./imports";

/**
 * 用途：引入 matchHotKey 函数，用于检测快捷键是否与配置匹配。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合快捷键匹配模块。
 */
import { matchHotKey } from "./imports";

/**
 * 用途：引入 switchDialog 对象，用于访问当前切换对话框的状态。
 * 使用范围：仅供 `state/index.ts` 内部使用。
 * 解耦评估：通过 `./imports` 桶转发，不直接耦合对话框切换模块。
 */
import { switchDialog } from "./imports";
/**
 * 用途：引入 `NavigationPressedHotkey` 辨识联合类型，用于标注状态收集阶段计算的单值导航快捷键事实。
 * 使用范围：仅用于 `findPressedNavigationHotkey` 的返回值类型推导辅助。
 * 解耦评估：纯类型依赖，不形成运行时耦合；继续经由 types barrel 转发即可。
 */
import type { NavigationPressedHotkey } from "../types";

/**
 * 用途：将 KeyboardEvent 的 target 解析为 HTMLElement，若不存在则回退到 document.body。
 * @简洁函数
 */
const resolveEventTarget = (event: KeyboardEvent) => event.target instanceof HTMLElement ? event.target : document.body;

/**
 * 用途：在已打开的对话框中查找最近文档对话框。
 * @简洁函数
 */
const findRecentDocsDialog = () => getSiyuanDialogs().find((item: Dialog) => item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS);

/**
 * 用途：判断按键是否为特殊对话框的导航键（Home/End/ArrowUp/ArrowDown）。
 * @简洁函数
 */
const isSpecialDialogNavigationKey = (key: string) => key === "Home" || key === "End" || key === "ArrowUp" || key === "ArrowDown";

/**
 * 用途：在已打开的对话框中查找特殊对话框（视图卡片/历史对比）。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const findSpecialDialog = () => {
    let matchDialog: Dialog | undefined = undefined;
    for (const item of getSiyuanDialogs()) {
        const dialogKey = item.element.getAttribute("data-key");
        // 视图卡片与历史对比对话框需要特殊路由处理（关闭时不归 dialog 子路由管辖）
        if (dialogKey === Constants.DIALOG_VIEWCARDS || dialogKey === Constants.DIALOG_HISTORYCOMPARE) {
            matchDialog = item;
        }
    }
    return matchDialog;
};

/**
 * 用途：将特殊对话框解析为类型字面量（"viewCards"/"historyCompare"/null）。
 * @显式返回类型原因 - 返回值为联合类型字面量，TypeScript 无法从实现中自动推断出具体字面量类型。
 */
const resolveSpecialDialogType = (specialDialog: WindowKeyDownState["specialDialog"]): SpecialDialogType => {
    const dialogKey = specialDialog?.element.getAttribute("data-key");
    if (dialogKey === Constants.DIALOG_VIEWCARDS) {
        return "viewCards";
    }
    if (dialogKey === Constants.DIALOG_HISTORYCOMPARE) {
        return "historyCompare";
    }
    return null;
};

/**
 * 用途：判断当前按键是否为菜单可处理的按键（方向键/回车）。
 * @简洁函数
 */
const isMenuHandledKey = (event: KeyboardEvent) => event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Enter";

/**
 * 用途：判断当前按键是否为属性面板可处理的按键（回车/ESC/方向键）。
 * @简洁函数
 */
const isAVPanelHandledKey = (event: KeyboardEvent) => event.key === "Enter" || event.key === "Escape" || event.key === "ArrowUp" || event.key === "ArrowDown";

/**
 * 用途：遍历所有停靠栏组件，检测当前事件是否匹配某组件的快捷键，返回匹配的组件类型。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const findDockHotkeyType = (event: KeyboardEvent) => {
    for (const item of getAllDocks()) {
        if (matchHotKey(item.hotkey, event)) {
            return item.type;
        }
    }
    return null;
};

/**
 * 用途：检测事件是否匹配自定义快捷键配置（含重复触发）。
 * @简洁函数
 */
const matchesConfiguredHotkey = (customHotkey: string | undefined, event: KeyboardEvent) => !!(customHotkey && matchHotKey(customHotkey, event));

/**
 * 用途：检测事件是否匹配自定义快捷键配置（排除重复触发，即 single-shot）。
 * @简洁函数
 */
const matchesConfiguredSingleShotHotkey = (customHotkey: string | undefined, event: KeyboardEvent) => !!(customHotkey && matchHotKey(customHotkey, event) && !event.repeat);

/**
 * 用途：遍历所有插件的命令，找出匹配当前快捷键且不含文件树/编辑器/停靠栏/全局回调的命令。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const findPluginCommand = (app: WindowKeyDownState["app"], event: KeyboardEvent) => {
    for (const plugin of app.plugins) {
        for (const command of plugin.commands) {
            if (
                command.callback &&
                !command.fileTreeCallback &&
                !command.editorCallback &&
                !command.dockCallback &&
                !command.globalCallback &&
                matchHotKey(command.customHotkey, event)
            ) {
                return { callback: command.callback } satisfies PluginCommandMatch;
            }
        }
    }
    return null;
};

// 对话框 aux 匹配项：[config key, pressedDialogHotkey 值]
const DIALOG_AUX_MATCHES = [
    ["goToEditTabNext", "switchDialogNextAux" as const],
    ["goToEditTabPrev", "switchDialogPrevAux" as const],
] as const;

// 对话框直接匹配项：[config key, pressedDialogHotkey 值]
const DIALOG_DIRECT_MATCHES = [
    ["goToEditTabNext", "openSwitchDialog" as const],
    ["goToEditTabPrev", "openSwitchDialog" as const],
    ["recentDocs", "openRecentDocs" as const],
] as const;

/**
 * 用途：按优先级检测当前事件命中的对话框快捷键（至多一个），以 early-return 线性扫描实现。
 * 优先级顺序：aux 匹配 > 直接匹配 > specialDialog 导航键
 * 使用范围：仅供 `collectDialogFacts` 调用。
 * 问题/改进：若未来增加新对话框快捷键，应在上方 DIALOG_AUX_MATCHES/DIALOG_DIRECT_MATCHES 中按优先级插入新的匹配项。
 */
const findPressedDialogHotkey = (
    generalKeymap: WindowKeyDownState["generalKeymap"],
    event: KeyboardEvent,
) => {
    for (const [key, value] of DIALOG_AUX_MATCHES) {
        const hotkeyConfig = generalKeymap?.[key];
        if (hotkeyConfig?.custom && matchAuxiliaryHotKey(hotkeyConfig.custom, event)) {
            return value;
        }
    }
    for (const [key, value] of DIALOG_DIRECT_MATCHES) {
        const hotkeyConfig = generalKeymap?.[key];
        if (hotkeyConfig?.custom && matchHotKey(hotkeyConfig.custom, event)) {
            return value;
        }
    }
    if (isSpecialDialogNavigationKey(event.key)) {
        return "specialDialogNavigation";
    }
    return null;
};

/**
 * 用途：收集对话框域的显式事实集合。
 * 意图：主路由字段 `pressedDialogHotkey` 由 `findPressedDialogHotkey` 计算，
 * 其余字段（hasSwitchDialog/isArrowKey 等）保持独立供路由阶段组合判断。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const collectDialogFacts = (
    generalKeymap: WindowKeyDownState["generalKeymap"],
    event: KeyboardEvent,
    currentSwitchDialog: WindowKeyDownState["switchDialog"],
    recentDocsDialog: WindowKeyDownState["recentDocsDialog"],
    specialDialog: WindowKeyDownState["specialDialog"],
) => {
    const isArrowKey = event.key.startsWith("Arrow");
    return {
        hasSwitchDialog: !!currentSwitchDialog,
        switchDialogMounted: !!currentSwitchDialog?.element.parentElement,
        isArrowKey,
        pressedDialogHotkey: findPressedDialogHotkey(generalKeymap, event),
        isArrowOrEnterWithoutModifiers: isNotCtrl(event) && !event.shiftKey && !event.altKey && (isArrowKey || event.key === "Enter"),
        hasRecentDocsDialog: !!recentDocsDialog,
        hasSpecialDialog: !!specialDialog,
    } satisfies WindowKeyDownState["dialog"];
};

/**
 * 用途：收集 UI 域的显式事实集合，包括菜单可见性、修饰键状态、属性面板状态等。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const collectUIFacts = (event: KeyboardEvent, target: HTMLElement) => {
    const menuElement = getSiyuanMenus()?.menu?.element;
    const avPanelRoot = document.querySelector(".av__panel");
    const avPanelElement = avPanelRoot instanceof HTMLElement ? avPanelRoot : null;

    return {
        menuVisible: !!menuElement && !menuElement.classList.contains("fn__none"),
        menuHandledKey: isMenuHandledKey(event),
        hasModifierKey: event.altKey || event.shiftKey || event.ctrlKey || event.metaKey,
        targetInMenuTextInput: !!menuElement && menuElement.contains(target) && ["INPUT", "TEXTAREA"].includes(target.tagName),
        avPanelVisible: avPanelElement !== null,
        avPanelHandledKey: isAVPanelHandledKey(event),
        avPanelHasRollupSearchMenu: !!(avPanelElement &&
            avPanelElement.querySelector('[data-type="goSearchRollupCol"]') &&
            !avPanelElement.querySelector(".b3-text-field")),
        avPanelHasExistingAssetMenu: !!(avPanelElement && avPanelElement.querySelector('[data-type="addAssetExist"]')),
    } satisfies WindowKeyDownState["ui"];
};

/**
 * 用途：收集系统域的显式事实集合，包括 Electron 环境标记、只读配置、确认对话框状态，
 * 以及缩放/同步/命令面板/锁定等系统级快捷键匹配结果。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const collectSystemFacts = (
    state: Pick<WindowKeyDownState, "event" | "target">,
    generalKeymap: WindowKeyDownState["generalKeymap"],
    confirmDialogElement: HTMLElement | null,
    isReadonlyConfig: boolean,
) => {
    const targetIsTextInput = ["INPUT", "TEXTAREA"].includes(state.target.tagName);
    const targetInPdf = !!hasClosestByClassName(state.target, "pdf__outer");
    const isEnterKey = state.event.key === "Enter";
    const isEscapeKey = state.event.key === "Escape";
    const isComposing = state.event.isComposing;

    return {
        isElectron,
        targetInPdf,
        targetIsTextInput,
        isReadonlyConfig,
        zoomInHotkey: matchHotKey("⌘=", state.event),
        zoomRestoreHotkey: matchHotKey("⌘0", state.event),
        zoomOutHotkey: matchHotKey("⌘-", state.event),
        syncNowHotkey: matchesConfiguredHotkey(generalKeymap?.syncNow?.custom, state.event),
        commandPanelHotkey: matchesConfiguredHotkey(generalKeymap?.commandPanel?.custom, state.event),
        toggleReadonlyHotkey: matchesConfiguredHotkey(generalKeymap?.editReadonly?.custom, state.event),
        lockScreenHotkey: matchesConfiguredHotkey(generalKeymap?.lockScreen?.custom, state.event),
        openHistoryHotkey: matchesConfiguredHotkey(generalKeymap?.dataHistory?.custom, state.event),
        toggleDockBarHotkey: matchesConfiguredHotkey(generalKeymap?.toggleDock?.custom, state.event),
        openSettingHotkey: matchesConfiguredHotkey(generalKeymap?.config?.custom, state.event),
        preventSelectAllHotkey: matchHotKey("⌘A", state.event),
        openRiffCardHotkey: matchesConfiguredHotkey(generalKeymap?.riffCard?.custom, state.event),
        openDailyNoteHotkey: matchesConfiguredHotkey(generalKeymap?.dailyNote?.custom, state.event),
        newFileHotkey: matchesConfiguredHotkey(generalKeymap?.newFile?.custom, state.event),
        hasConfirmDialog: !!confirmDialogElement,
        isEnterKey,
        isEscapeKey,
        isComposing,
    } satisfies WindowKeyDownState["system"];
};

/**
 * 用途：检测当前事件命中了哪个导航快捷键（至多一个）。
 * 意图：将 24+ 次无条件布尔计算降级为首次匹配即退出的线性扫描，
 * 避免在状态收集阶段预计算所有布尔值、将路由降格为布尔查表。
 * 使用范围：仅供 `collectNavigationFacts` 调用。
 */
/** @note: 所有元素必须是 NavigationPressedHotkey 的字面值且为 WindowGeneralKeymap 的键。 */
const NAVIGATION_REPEAT_HOTKEYS = [
    "mainMenu",
    "goForward",
    "goBack",
    "recentClosed",
    "stickSearch",
] as const satisfies readonly NavigationPressedHotkey[];

/** @note: 所有元素必须是 NavigationPressedHotkey 的字面值且为 WindowGeneralKeymap 的键。 */
const NAVIGATION_SINGLE_SHOT_HOTKEYS = [
    "closeTab",
    "closeOthers",
    "closeAll",
    "closeUnmodified",
    "closeLeft",
    "closeRight",
    "goToTab1",
    "goToTab2",
    "goToTab3",
    "goToTab4",
    "goToTab5",
    "goToTab6",
    "goToTab7",
    "goToTab8",
    "goToTab9",
    "goToTabNext",
    "goToTabPrev",
    "splitLR",
    "splitMoveR",
    "splitTB",
    "tabToWindow",
    "splitMoveB",
    "unsplit",
    "unsplitAll",
] as const satisfies readonly NavigationPressedHotkey[];

/**
 * 用途：检测当前事件命中了哪个导航快捷键（至多一个），以 early-return 线性扫描实现。
 * 意图：将 24+ 次无条件布尔计算降级为首次匹配即退出的线性扫描，
 * 避免在状态收集阶段预计算所有布尔值、将路由降格为布尔查表。
 * 使用范围：仅供 `collectNavigationFacts` 调用。
 */
const findPressedNavigationHotkey = (
    generalKeymap: WindowKeyDownState["generalKeymap"],
    event: KeyboardEvent,
) => {
    for (const key of NAVIGATION_REPEAT_HOTKEYS) {
        const hotkeyConfig = generalKeymap?.[key];
        if (matchesConfiguredHotkey(hotkeyConfig?.custom, event)) {
            return key;
        }
    }
    for (const key of NAVIGATION_SINGLE_SHOT_HOTKEYS) {
        const hotkeyConfig = generalKeymap?.[key];
        if (matchesConfiguredSingleShotHotkey(hotkeyConfig?.custom, event)) {
            return key;
        }
    }
    return null;
};

/**
 * 用途：收集导航域的显式事实集合。
 * 意图：主路由字段 `pressedNavigationHotkey` 由 `findPressedNavigationHotkey` 计算，
 * 委托链字段（replace/globalSearch/search/save）保持独立布尔值供下游 `navigation.delegatedFallback.ts` 消费。
 * 使用范围：仅供 `collectWindowKeyDownState` 调用。
 */
const collectNavigationFacts = (
    state: Pick<WindowKeyDownState, "event" | "target">,
    generalKeymap: WindowKeyDownState["generalKeymap"],
) => ({
    pressedNavigationHotkey: findPressedNavigationHotkey(generalKeymap, state.event),
    replaceHotkey: matchesConfiguredHotkey(generalKeymap?.replace?.custom, state.event),
    globalSearchHotkey: matchesConfiguredHotkey(generalKeymap?.globalSearch?.custom, state.event),
    searchHotkey: !hasClosestByClassName(state.target, "pdf__outer") && matchesConfiguredHotkey(generalKeymap?.search?.custom, state.event),
    saveHotkey: matchHotKey("⌘S", state.event),
} satisfies WindowKeyDownState["navigation"]);

/** @同步豁免: 需要绝对同步的 DOM 访问与事件现场读取。 */
export const collectWindowKeyDownState = async (app: WindowKeyDownState["app"], event: KeyboardEvent) => {
    const config = getSafeSiyuanConfig();
    const generalKeymap = config?.keymap?.general;
    const target = resolveEventTarget(event);
    const isArrowOrEnterWithoutModifiers = isNotCtrl(event) && !event.shiftKey && !event.altKey && (event.key.startsWith("Arrow") || event.key === "Enter");
    const recentDocsDialog = isArrowOrEnterWithoutModifiers ? findRecentDocsDialog() : undefined;
    const specialDialog = isSpecialDialogNavigationKey(event.key) ? findSpecialDialog() : undefined;
    const confirmDialogElement = document.querySelector<HTMLElement>('.b3-dialog--open[data-key="dialog-confirm"]');
    const baseState = {
        app,
        event,
        target,
        isTabWindow: isWindow(),
        generalKeymap,
        switchDialog,
        recentDocsDialog,
        specialDialog,
        specialDialogType: resolveSpecialDialogType(specialDialog),
        dockHotkeyType: findDockHotkeyType(event),
        confirmDialogElement: confirmDialogElement ?? null,
        pluginCommand: findPluginCommand(app, event),
    };

    return {
        ...baseState,
        dialog: collectDialogFacts(generalKeymap, event, switchDialog, recentDocsDialog, specialDialog),
        ui: collectUIFacts(event, target),
        system: collectSystemFacts(baseState, generalKeymap, confirmDialogElement ?? null, !!config?.readonly),
        navigation: collectNavigationFacts(baseState, generalKeymap),
    } satisfies WindowKeyDownState;
};
