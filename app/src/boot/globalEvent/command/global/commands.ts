/** 移动端全局命令名集合，供根路由识别移动端可处理命令并供移动端执行器声明 split 条件。 */
export const MOBILE_GLOBAL_COMMANDS = {
    FILE_TREE: "fileTree",
    OUTLINE: "outline",
    BOOKMARK: "bookmark",
    TAG: "tag",
    INBOX: "inbox",
    BACKLINKS: "backlinks",
    MAIN_MENU: "mainMenu",
    GLOBAL_SEARCH: "globalSearch",
    RECENT_DOCS: "recentDocs",
} as const;

/** 桌面端全局命令名集合，供根路由识别桌面端可处理命令并供桌面端执行器声明 split 条件。 */
export const DESKTOP_GLOBAL_COMMANDS = {
    FILE_TREE: "fileTree",
    OUTLINE: "outline",
    BOOKMARK: "bookmark",
    TAG: "tag",
    INBOX: "inbox",
    BACKLINKS: "backlinks",
    GRAPH_VIEW: "graphView",
    GLOBAL_GRAPH: "globalGraph",
    CONFIG: "config",
    GLOBAL_SEARCH: "globalSearch",
    STICK_SEARCH: "stickSearch",
    GO_BACK: "goBack",
    GO_FORWARD: "goForward",
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
    MAIN_MENU: "mainMenu",
    RECENT_DOCS: "recentDocs",
    RECENT_CLOSED: "recentClosed",
    TOGGLE_DOCK: "toggleDock",
    SWITCH_LEFT_DOCK: "switchLeftDock",
    SWITCH_RIGHT_DOCK: "switchRightDock",
    SWITCH_BOTTOM_DOCK: "switchBottomDock",
    TOGGLE_WIN: "toggleWin",
    GO_TO_EDIT_TAB_NEXT: "goToEditTabNext",
    GO_TO_EDIT_TAB_PREV: "goToEditTabPrev",
    CLOSE_UNMODIFIED: "closeUnmodified",
    UNSPLIT_ALL: "unsplitAll",
    UNSPLIT: "unsplit",
    CLOSE_TAB: "closeTab",
    CLOSE_OTHERS: "closeOthers",
    CLOSE_ALL: "closeAll",
    CLOSE_LEFT: "closeLeft",
    CLOSE_RIGHT: "closeRight",
    SPLIT_LR: "splitLR",
    SPLIT_TB: "splitTB",
    SPLIT_MOVE_B: "splitMoveB",
    SPLIT_MOVE_R: "splitMoveR",
    TAB_TO_WINDOW: "tabToWindow",
} as const;

/** 通用全局命令名集合，供根路由识别不区分平台的命令并供通用执行器声明 split 条件。 */
export const COMMON_GLOBAL_COMMANDS = {
    DAILY_NOTE: "dailyNote",
    DATA_HISTORY: "dataHistory",
    EDIT_READONLY: "editReadonly",
    LOCK_SCREEN: "lockScreen",
    NEW_FILE: "newFile",
    RIFF_CARD: "riffCard",
    SELECT_OPEN_1: "selectOpen1",
    SYNC_NOW: "syncNow",
} as const;

/** 移动端命令值列表，供根路由在状态提取阶段判断当前命令是否属于移动端处理域。 */
export const MOBILE_GLOBAL_COMMAND_VALUES = Object.values(MOBILE_GLOBAL_COMMANDS);

/** 桌面端命令值列表，供根路由在状态提取阶段判断当前命令是否属于桌面端处理域。 */
export const DESKTOP_GLOBAL_COMMAND_VALUES = Object.values(DESKTOP_GLOBAL_COMMANDS);

/** 通用命令值列表，供根路由在状态提取阶段判断当前命令是否属于通用处理域。 */
export const COMMON_GLOBAL_COMMAND_VALUES = Object.values(COMMON_GLOBAL_COMMANDS);
