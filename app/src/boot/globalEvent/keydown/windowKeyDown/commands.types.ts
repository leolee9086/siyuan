/**
 * 用途：集中定义窗口级键盘事件在"路由 + 执行"链路中的共享命令契约。
 * 使用范围：仅供 `windowKeyDown` 根入口及其 dialog/system/navigation 子域模块复用。
 * 解耦评估：命令常量保持单一来源，避免多个子域文件重复硬编码字符串值，也避免状态类型文件膨胀。
 */

/**
 * 用途：定义对话框阶段路由器返回的稳定命令集合。
 * 使用范围：供对话框阶段路由器与执行器共享命令契约。
 * 解耦评估：命令常量应保持单一来源，避免多个子域文件重复硬编码字符串。
 */
export const DIALOG_WINDOW_KEY_COMMANDS = {
    IGNORE: "ignore",
    SWITCH_DIALOG_ARROW: "switchDialogArrow",
    OPEN_SWITCH_DIALOG: "openSwitchDialog",
    RECENT_DOCS_DIALOG_ARROW: "recentDocsDialogArrow",
    OPEN_RECENT_DOCS: "openRecentDocs",
    VIEW_CARDS_DIALOG_NAVIGATION: "viewCardsDialogNavigation",
    HISTORY_COMPARE_DIALOG_NAVIGATION: "historyCompareDialogNavigation",
} as const;

/**
 * 用途：定义系统阶段路由器返回的稳定命令集合。
 * 使用范围：供系统阶段路由器与执行器共享命令契约。
 * 解耦评估：命令常量应保持单一来源，避免多个子域文件重复硬编码字符串。
 */
export const SYSTEM_WINDOW_KEY_COMMANDS = {
    IGNORE: "ignore",
    ZOOM_IN: "zoomIn",
    ZOOM_RESTORE: "zoomRestore",
    ZOOM_OUT: "zoomOut",
    SYNC_NOW: "syncNow",
    COMMAND_PANEL: "commandPanel",
    TOGGLE_READONLY: "toggleReadonly",
    LOCK_SCREEN: "lockScreen",
    OPEN_HISTORY: "openHistory",
    TOGGLE_DOCK_BAR: "toggleDockBar",
    OPEN_SETTING: "openSetting",
    PREVENT_SELECT_ALL: "preventSelectAll",
    TOGGLE_DOCK_MODEL: "toggleDockModel",
    OPEN_RIFF_CARD: "openRiffCard",
    OPEN_DAILY_NOTE: "openDailyNote",
    NEW_FILE: "newFile",
    CONFIRM_DIALOG_ENTER: "confirmDialogEnter",
    CONFIRM_DIALOG_ESCAPE: "confirmDialogEscape",
    ESCAPE: "escape",
} as const;

/**
 * 用途：定义窗口级 UI 抢占阶段返回的稳定命令集合。
 * 使用范围：供统一路由器与入口执行器共享菜单系统和 AV 面板的命令契约。
 * 解耦评估：菜单与 AV 仍复用既有中间件实现，但命中结果统一收敛为单一命令来源，避免入口层继续手写条件分支。
 */
export const UI_WINDOW_KEY_COMMANDS = {
    IGNORE: "ignore",
    MENU: "menu",
    AV_PANEL: "avPanel",
} as const;

/**
 * 用途：定义导航阶段路由器返回的稳定命令集合。
 * 使用范围：供导航阶段路由器与执行器共享命令契约。
 * 解耦评估：命令常量应保持单一来源，避免多个子域文件重复硬编码字符串。
 */
export const NAVIGATION_WINDOW_KEY_COMMANDS = {
    MAIN_MENU: "mainMenu",
    GO_FORWARD: "goForward",
    GO_BACK: "goBack",
    RECENT_CLOSED: "recentClosed",
    CLOSE_TAB: "closeTab",
    CLOSE_OTHERS: "closeOthers",
    CLOSE_ALL: "closeAll",
    CLOSE_UNMODIFIED: "closeUnmodified",
    CLOSE_LEFT: "closeLeft",
    CLOSE_RIGHT: "closeRight",
    GO_TO_TAB_1: "goToTab1",
    GO_TO_TAB_2: "goToTab2",
    GO_TO_TAB_3: "goToTab3",
    GO_TO_TAB_4: "goToTab4",
    GO_TO_TAB_5: "goToTab5",
    GO_TO_TAB_6: "goToTab6",
    GO_TO_TAB_7: "goToTab7",
    GO_TO_TAB_8: "goToTab8",
    GO_TO_TAB_9: "goToTab9",
    GO_TO_TAB_NEXT: "goToTabNext",
    GO_TO_TAB_PREV: "goToTabPrev",
    SPLIT_LR: "splitLR",
    SPLIT_MOVE_R: "splitMoveR",
    SPLIT_TB: "splitTB",
    TAB_TO_WINDOW: "tabToWindow",
    SPLIT_MOVE_B: "splitMoveB",
    STICK_SEARCH: "stickSearch",
    UNSPLIT: "unsplit",
    UNSPLIT_ALL: "unsplitAll",
    DELEGATED_KEYDOWN: "delegatedKeydown",
} as const;

/**
 * 用途：表示对话框阶段命令的受控联合类型。
 * 使用场景：供对话框执行器与命令映射表标注命令入参。
 * 关联类型：来自 [`DIALOG_WINDOW_KEY_COMMANDS`]。
 * 问题/改进：若命令继续增长，应同步评估执行器映射表的可维护性。
 */
export type DialogWindowKeyCommand = typeof DIALOG_WINDOW_KEY_COMMANDS[keyof typeof DIALOG_WINDOW_KEY_COMMANDS];

/**
 * 用途：表示系统阶段命令的受控联合类型。
 * 使用场景：供系统执行器与命令映射表标注命令入参。
 * 关联类型：来自 [`SYSTEM_WINDOW_KEY_COMMANDS`]。
 * 问题/改进：若 Esc 继续拆分为更细命令，可在这里同步细化类型。
 */
export type SystemWindowKeyCommand = typeof SYSTEM_WINDOW_KEY_COMMANDS[keyof typeof SYSTEM_WINDOW_KEY_COMMANDS];

/**
 * 用途：表示窗口级 UI 抢占阶段命令的受控联合类型。
 * 使用场景：供统一路由器与入口执行器标注菜单系统和 AV 面板的命令入参。
 * 关联类型：来自 [`UI_WINDOW_KEY_COMMANDS`]。
 * 问题/改进：若未来继续把更多遗留中间件并入统一路由，可在这里继续扩展。
 */
export type UIWindowKeyCommand = typeof UI_WINDOW_KEY_COMMANDS[keyof typeof UI_WINDOW_KEY_COMMANDS];

/**
 * 用途：表示导航域命令的受控联合类型。
 * 使用场景：供导航执行器与命令映射表标注命令入参。
 * 关联类型：来自 [`NAVIGATION_WINDOW_KEY_COMMANDS`]。
 * 问题/改进：若未来把兜底委托链继续细分为更多导航子命令，需要同步扩展这里。
 */
export type NavigationWindowKeyCommand = typeof NAVIGATION_WINDOW_KEY_COMMANDS[keyof typeof NAVIGATION_WINDOW_KEY_COMMANDS];

/**
 * 用途：表示窗口级根路由在各子域 facts 路由完成后得到的稳定命令集合。
 * 使用场景：供根入口只按 dialog/ui/system/navigation 域优先级做最终分发。
 * 关联类型：聚合了 [`DialogWindowKeyCommand`]、[`UIWindowKeyCommand`]、[`SystemWindowKeyCommand`] 与 [`NavigationWindowKeyCommand`]。
 * 问题/改进：若未来继续新增窗口级域，需要同步在这里补充对应命令字段。
 */
export type WindowKeyDownResolvedCommands = {
    dialogCommand: DialogWindowKeyCommand;
    uiCommand: UIWindowKeyCommand;
    systemCommand: SystemWindowKeyCommand;
    navigationCommand: NavigationWindowKeyCommand;
};

/**
 * 用途：表示窗口级根路由最终选出的目标子集。
 * 使用场景：供 route/ 阶段表达根级优先级结果，并供 subset/ 阶段选择对应命令执行入口。
 * 关联类型：与 [`WindowKeyDownResolvedCommands`] 共同组成根级分发所需的最小契约。
 * 问题/改进：当前仅覆盖 dialog/ui/system/navigation 四个子集；若未来新增窗口级处理阶段，需要同步扩展这里与根路由实现。
 */
export type WindowKeyDownRouteDomain = "dialog" | "ui" | "system" | "navigation";

/**
 * 用途：表示 UI 抢占域中真正会落到执行器的命令类型。
 * 使用场景：菜单系统与 AV 面板已经进入统一状态空间后，映射表只应覆盖非 `ignore` 的可执行命令。
 * 关联类型：来自 [`UIWindowKeyCommand`]。
 * 问题/改进：若未来继续并入更多 UI 中间件，需要同步扩展这里与根入口执行器映射表。
 */
export type UIWindowKeyHandledCommand = Exclude<UIWindowKeyCommand, typeof UI_WINDOW_KEY_COMMANDS.IGNORE>;

/**
 * 用途：表示统一状态空间分割直接产出的窗口级执行器类型。
 * 使用场景：根入口完成一次状态空间分割后，直接拿到统一执行器并执行，不再经过额外的人为解释层。
 * 关联类型：消费 [`WindowKeyDownState`]。
 * 问题/改进：若未来执行器需要携带更多诊断信息，可在不引入新分发轴的前提下为返回值增加结构化元数据。
 */
export type WindowKeyDownExecutor<TState> = (state: TState) => boolean | Promise<boolean>;
