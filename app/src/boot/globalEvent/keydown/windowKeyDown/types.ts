/**
 * 用途：集中定义窗口级键盘事件在“状态收集 + 状态空间路由 + 执行器”链路中的统一状态空间与命令契约。
 * 使用范围：仅供 `windowKeyDown` 根入口及其 dialog/system/navigation 子域模块复用。
 * 解耦评估：当前交互过程只保留一个统一状态定义，子域模块只消费这个统一状态的受控切片，避免出现多个平行状态空间导致契约漂移。
 */

/**
 * 用途：表示窗口级对话框阶段需要区分的特殊对话框种类。
 * 使用场景：在统一状态中记录卡片浏览与历史比较对话框，供对话框执行器做差异化处理。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `specialDialogType` 字段引用。
 * 问题/改进：如果未来新增会抢占方向键的弹层，需要同步扩展这里与对应执行器映射。
 */
export type SpecialDialogType = "viewCards" | "historyCompare" | null;

/**
 * 用途：表示插件命令扫描命中后的最小结果。
 * 使用场景：导航阶段状态收集在统一状态中保存插件 callback，供导航执行器兜底链调用。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `pluginCommand` 字段引用。
 * 问题/改进：当前只保留 callback；若后续需要诊断或日志，可扩展插件名和命令键位等元数据。
 */
export interface PluginCommandMatch {
    callback: () => void;
}

/**
 * 用途：表示窗口级键盘交互会读取的最小快捷键项结构。
 * 使用场景：统一状态中的 `generalKeymap` 只关心 `custom` 自定义键位配置，因此无需直接暴露全局配置命名空间的完整形状。
 * 关联类型：被 [`WindowGeneralKeymap`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的各键位字段复用。
 * 问题/改进：若后续窗口级逻辑需要读取更多键位元数据，可在这里继续扩展。
 */
export interface WindowKeymapItem {
    custom?: string;
}

/**
 * 用途：表示窗口级键盘交互真正会消费的 `general` 键位配置子集。
 * 使用场景：统一状态只收敛窗口级分发所需的键位字段，避免继续依赖全局 `Config` ambient namespace 作为局部状态边界。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `generalKeymap` 字段引用。
 * 问题/改进：若未来窗口级命令继续扩展，需要同步补充这里与对应事实收集器。
 */
export interface WindowGeneralKeymap {
    commandPanel?: WindowKeymapItem; closeAll?: WindowKeymapItem; closeLeft?: WindowKeymapItem;
    closeOthers?: WindowKeymapItem; closeRight?: WindowKeymapItem; closeTab?: WindowKeymapItem;
    closeUnmodified?: WindowKeymapItem; config?: WindowKeymapItem; dailyNote?: WindowKeymapItem;
    dataHistory?: WindowKeymapItem; editReadonly?: WindowKeymapItem; globalSearch?: WindowKeymapItem;
    goBack?: WindowKeymapItem; goForward?: WindowKeymapItem; goToEditTabNext?: WindowKeymapItem;
    goToEditTabPrev?: WindowKeymapItem; goToTab1?: WindowKeymapItem; goToTab2?: WindowKeymapItem;
    goToTab3?: WindowKeymapItem; goToTab4?: WindowKeymapItem; goToTab5?: WindowKeymapItem;
    goToTab6?: WindowKeymapItem; goToTab7?: WindowKeymapItem; goToTab8?: WindowKeymapItem;
    goToTab9?: WindowKeymapItem; goToTabNext?: WindowKeymapItem; goToTabPrev?: WindowKeymapItem;
    lockScreen?: WindowKeymapItem; mainMenu?: WindowKeymapItem; newFile?: WindowKeymapItem;
    recentClosed?: WindowKeymapItem; recentDocs?: WindowKeymapItem; replace?: WindowKeymapItem;
    riffCard?: WindowKeymapItem; search?: WindowKeymapItem; splitLR?: WindowKeymapItem;
    splitMoveB?: WindowKeymapItem; splitMoveR?: WindowKeymapItem; splitTB?: WindowKeymapItem;
    stickSearch?: WindowKeymapItem; syncNow?: WindowKeymapItem; tabToWindow?: WindowKeymapItem;
    toggleDock?: WindowKeymapItem; unsplit?: WindowKeymapItem; unsplitAll?: WindowKeymapItem;
}

/**
 * 用途：表示对话框域在统一状态中收集的"按下了哪个对话框快捷键"的辨识联合类型。
 * 使用场景：状态收集只计算当前命中了哪个对话框快捷键（恰好一个或空），
 * 路由阶段基于这个单值辨识联合进行状态空间分割，不再依赖先验的布尔全集求值。
 * 关联类型：被 [`WindowKeyDownDialogFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `pressedDialogHotkey` 字段引用。
 * 问题/改进：若未来对话框快捷键继续增加，应继续补充这里的事实字段与对应 split 规则，而不是回退到布尔全集求值模式。
 */
export type DialogPressedHotkey =
    | "switchDialogNextAux"
    | "switchDialogPrevAux"
    | "openSwitchDialog"
    | "openRecentDocs"
    | "specialDialogNavigation"
    | null;

/**
 * 用途：表示对话框域在统一状态中收集的显式事实集合。
 * 使用场景：根路由直接根据这些显式事实（含 `pressedDialogHotkey` 辨识联合）进行状态空间分割，
 * 而非消费预归并的对话框意图。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `dialog` 字段引用。
 * 问题/改进：若未来对话框优先级继续扩展，应继续补充事实字段（而非回退到新的意图归并层），
 * 快捷键类事实应继续收敛到 `pressedDialogHotkey` 辨识联合而非拆回布尔字段。
 */
export interface WindowKeyDownDialogFacts {
    hasSwitchDialog: boolean;
    switchDialogMounted: boolean;
    isArrowKey: boolean;
    pressedDialogHotkey: DialogPressedHotkey;
    isArrowOrEnterWithoutModifiers: boolean;
    hasRecentDocsDialog: boolean;
    hasSpecialDialog: boolean;
}

/**
 * 用途：表示 UI 抢占域在统一状态中收集的显式事实集合。
 * 使用场景：根路由直接根据菜单系统与 AV 面板的上下文事实决定是否抢占当前按键。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `ui` 字段引用。
 * 问题/改进：若未来继续并入更多窗口级 UI 中间件，应继续补充事实字段，而不是重新引入阶段意图。
 */
export interface WindowKeyDownUIFacts {
    menuVisible: boolean;
    menuHandledKey: boolean;
    hasModifierKey: boolean;
    targetInMenuTextInput: boolean;
    avPanelVisible: boolean;
    avPanelHandledKey: boolean;
    avPanelHasRollupSearchMenu: boolean;
    avPanelHasExistingAssetMenu: boolean;
}

/**
 * 用途：表示系统域在统一状态中收集的显式事实集合。
 * 使用场景：根路由直接根据系统快捷键、环境与确认对话框事实进行状态空间分割。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `system` 字段引用。
 * 问题/改进：若系统域继续扩展，应优先补充事实字段，而不是在收集阶段合并成新的单一意图。
 */
export interface WindowKeyDownSystemFacts {
    isElectron: boolean;
    targetInPdf: boolean;
    targetIsTextInput: boolean;
    isReadonlyConfig: boolean;
    zoomInHotkey: boolean;
    zoomRestoreHotkey: boolean;
    zoomOutHotkey: boolean;
    syncNowHotkey: boolean;
    commandPanelHotkey: boolean;
    toggleReadonlyHotkey: boolean;
    lockScreenHotkey: boolean;
    openHistoryHotkey: boolean;
    toggleDockBarHotkey: boolean;
    openSettingHotkey: boolean;
    preventSelectAllHotkey: boolean;
    openRiffCardHotkey: boolean;
    openDailyNoteHotkey: boolean;
    newFileHotkey: boolean;
    hasConfirmDialog: boolean;
    isEnterKey: boolean;
    isEscapeKey: boolean;
    isComposing: boolean;
}

/**
 * 用途：表示导航域在统一状态中收集的"按下了哪个导航快捷键"的辨识联合类型。
 * 使用场景：状态收集只计算当前按下了哪个导航快捷键（恰好一个或空），
 * 路由阶段基于这个单值辨识联合进行状态空间分割，不再依赖先验的布尔全集求值。
 * 关联类型：被 [`WindowKeyDownNavigationFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `pressedNavigationHotkey` 字段引用。
 * 问题/改进：若未来导航显式命令继续增加，应继续补充这里的事实字段与对应 split 规则，而不是回退到新的 payload 归并层。
 */
export type NavigationPressedHotkey =
    | "mainMenu" | "goForward" | "goBack" | "recentClosed"
    | "closeTab" | "closeOthers" | "closeAll" | "closeUnmodified" | "closeLeft" | "closeRight"
    | "goToTab1" | "goToTab2" | "goToTab3" | "goToTab4" | "goToTab5"
    | "goToTab6" | "goToTab7" | "goToTab8" | "goToTab9" | "goToTabNext" | "goToTabPrev"
    | "splitLR" | "splitMoveR" | "splitTB" | "tabToWindow" | "splitMoveB"
    | "stickSearch" | "unsplit" | "unsplitAll"
    | null;

/**
 * 用途：表示导航域在统一状态中收集的显式事实集合。
 * 使用场景：导航子路由直接根据 `pressedNavigationHotkey` 辨识联合进行状态空间分割，
 * 剩余路径再落入委托链。委托链命令（replace/globalSearch/search/save）保持独立布尔字段，
 * 由下游 `navigation.delegatedFallback.ts` 单独消费，避免混入路由主链路。
 * 关联类型：被 [`WindowKeyDownState`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 的 `navigation` 字段引用。
 * 问题/改进：若未来导航显式命令继续增加，应继续补充 `NavigationPressedHotkey` 联合成员与对应 split 规则，
 * 而不是回退到布尔全集求值模式。
 */
export interface WindowKeyDownNavigationFacts {
    /** 当前按键命中的导航快捷键（至多一个），供路由主链路做状态空间分割。 */
    pressedNavigationHotkey: NavigationPressedHotkey;
    /** 以下四个委托链命令保持独立布尔字段，仅供 `navigation.delegatedFallback.ts` 消费。 */
    replaceHotkey: boolean;
    globalSearchHotkey: boolean;
    searchHotkey: boolean;
    saveHotkey: boolean;
}


/**
 * 用途：表示窗口级键盘交互过程的统一状态空间定义。
 * 使用场景：由对话框、系统、导航三个事实收集器增量填充显式事实，再由统一根路由与导航子路由进行一次性分发。
 * 关联类型：聚合了 [`WindowKeyDownDialogFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts)、[`WindowKeyDownUIFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts)、[`WindowKeyDownSystemFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts) 与 [`WindowKeyDownNavigationFacts`](d:/dev/siyuan-note/app/src/boot/globalEvent/keydown/windowKeyDown/types.ts)。
 * 问题/改进：当前搜索与全局过滤器仍保留为入口前置短路；若未来也完全状态化，可继续并入这份统一状态。
 */
export interface WindowKeyDownRouteState {
    isTabWindow: boolean;
    specialDialogType: SpecialDialogType;
    dockHotkeyType: string | null;
    dialog: WindowKeyDownDialogFacts;
    ui: WindowKeyDownUIFacts;
    system: WindowKeyDownSystemFacts;
    navigation: WindowKeyDownNavigationFacts;
}

/** 窗口键运行状态；应用与对话框身份由状态收集实现边界绑定。 */
export interface WindowKeyDownState<TApplication, TDialog> extends WindowKeyDownRouteState {
    app: TApplication;
    event: KeyboardEvent;
    target: HTMLElement;
    generalKeymap: WindowGeneralKeymap | undefined;
    switchDialog: TDialog | undefined;
    recentDocsDialog: TDialog | undefined;
    specialDialog: TDialog | undefined;
    confirmDialogElement: HTMLElement | null;
    pluginCommand: PluginCommandMatch | null;
}

