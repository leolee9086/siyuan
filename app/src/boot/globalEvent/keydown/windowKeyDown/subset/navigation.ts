/**
 * 用途：执行窗口级键盘事件在导航子集中的最终命令。
 * 使用范围：仅供 `windowKeyDown/subset/index.ts` 在根路由命中导航子集后调用。
 * 解耦评估：当前文件只处理导航命令到叶子动作的路由与落地，不再承担 facts 判断，因此保持了“子集处理”阶段的职责纯度。
 */
/**
 * 用途：引入导航子集执行器所需的命令契约类型 NavigationWindowKeyCommand，供导出函数 executeNavigationWindowKeyCommand 签名使用。
 * 使用范围：仅当前文件导出函数签名。
 * 解耦评估：纯类型导入，编译期完全擦除，不形成运行时耦合。
 */
import type { NavigationWindowKeyCommand } from "./imports";
/**
 * 用途：引入统一状态类型 WindowKeyDownState，供所有导航执行器函数签名使用。
 * 使用范围：仅当前文件内各执行器函数签名与回调类型标注。
 * 解耦评估：纯类型依赖，仅用于执行器回调签名标注，不形成运行时耦合。
 */
import type { WindowKeyDownState } from "./imports";
/**
 * 用途：引入声明式状态路由 DSL calibur，用于构建 navigationWindowKeyCommandRouter 及子路由链（tabExec/tabSwitch/layout）的多级命令分发。
 * 使用范围：仅当前文件内所有 calibur 路由链定义。
 * 解耦评估：DSL 定义必须在模块作用域静态声明，无法通过参数注入或事件发射替代。
 */
import { calibur } from "./imports";
/**
 * 用途：引入编辑区键盘事件处理器 editKeydown，在 executeDelegatedKeydownPreHandlers 中作为委托预处理的第一优先级处理器。
 * 使用范围：仅当前文件 executeDelegatedKeydownPreHandlers 函数中调用。
 * 解耦评估：editKeydown 是全局编辑区键盘事件入口，当前作为委托预处理链的一环调用；可通过参数传入解耦，但编辑区键盘处理立项约定通过导入调用，保持现有方式一致。
 */
import { editKeydown } from "./imports";
/**
 * 用途：引入命令执行入口 execByCommand，用于标签页关闭（closeTab/closeOthers 等）和搜索跳转（replace/globalSearch/search）等场景。
 * 使用范围：仅当前文件 createExecByCommandWindowKeyHandler 和 createExecByCommandWithAppWindowKeyHandler 工厂函数内部调用。
 * 解耦评估：execByCommand 是全局命令调度入口，当前通过导入调用；可通过参数注入解耦，但该入口在项目中广泛使用且为单例调度器，保持现有方式与项目约定一致。
 */
import { execByCommand } from "./imports";
/**
 * 用途：引入文档树键盘事件处理器 fileTreeKeydown，在 executeDelegatedKeydownPreHandlers 中作为委托预处理的第二优先级处理器（非标签页窗口时触发）。
 * 使用范围：仅当前文件 executeDelegatedKeydownPreHandlers 函数中调用，受 state.isTabWindow 条件保护。
 * 解耦评估：同 editKeydown，通过 ./imports 集中转发保持解耦。
 */
import { fileTreeKeydown } from "./imports";
/**
 * 用途：引入全局布局命令入口 globalCommand，用于创建布局子命令（splitLR/splitTB 等）的窗口级键盘响应。
 * 使用范围：仅当前文件 createLayoutWindowKeyHandler 工厂函数内部调用。
 * 解耦评估：globalCommand 是全局布局调度入口，通过导入使用；与项目其他键盘事件处理器一致，保持现有导入方式。
 */
import { globalCommand } from "./imports";
/**
 * 用途：引入历史后退操作 goBack，用于 executeGoBackNavigationWindowKeyCommand 执行器。
 * 使用范围：仅当前文件 executeGoBackNavigationWindowKeyCommand 函数中调用。
 * 解耦评估：goBack 从 util/platform/backForward 导出，通过 ./imports 间接引用；可通过参数注入替代，但保持与项目一致的导入方式。
 */
import { goBack } from "./imports";
/**
 * 用途：引入历史前进操作 goForward，用于 executeGoForwardNavigationWindowKeyCommand 执行器。
 * 使用范围：仅当前文件 executeGoForwardNavigationWindowKeyCommand 函数中调用。
 * 解耦评估：同 goBack，是平台导航工具，通过 ./imports 间接引用，保持与项目一致的导入方式。
 */
import { goForward } from "./imports";
/**
 * 用途：引入导航窗口键命令常量枚举 NAVIGATION_WINDOW_KEY_COMMANDS，供所有路由链 split 条件匹配使用。
 * 使用范围：仅当前文件内 tabExecNavigationWindowKeyCommandRouter、tabSwitchNavigationWindowKeyCommandRouter、layoutNavigationWindowKeyCommandRouter、navigationWindowKeyCommandRouter 的分叉条件定义。
 * 解耦评估：命令常量是执行器与路由层之间的共享契约，为只读常量，不形成可变状态耦合。
 */
import { NAVIGATION_WINDOW_KEY_COMMANDS } from "./imports";
/**
 * 用途：引入面板树键盘事件处理器 panelTreeKeydown，在 executeDelegatedKeydownPreHandlers 中作为委托预处理的第三优先级处理器（非标签页窗口时触发）。
 * 使用范围：仅当前文件 executeDelegatedKeydownPreHandlers 函数中调用，受 state.isTabWindow 条件保护。
 * 解耦评估：同 fileTreeKeydown，通过 ./imports 集中转发保持解耦。
 */
import { panelTreeKeydown } from "./imports";
/**
 * 用途：引入标签页切换工具 switchTabByIndex，用于 createSwitchTabByIndexWindowKeyHandler 工厂函数实现标签页索引跳转。
 * 使用范围：仅当前文件 createSwitchTabByIndexWindowKeyHandler 工厂函数内部调用。
 * 解耦评估：switchTabByIndex 从 layout/tabUtil 导出，通过 ./imports 间接引用；保持与项目一致的导入方式。
 */
import { switchTabByIndex } from "./imports";
/**
 * 用途：引入 arktype 运行时类型守卫 type，用于 calibur 路由 split 分支的条件 DSL 匹配。
 * 使用范围：仅当前文件内所有 calibur 路由链的 universe/split 条件定义。
 * 解耦评估：arktype 是 calibur-router 路由链声明的 DSL 基础设施组件，必须在模块作用域静态导入，无法通过参数注入替代。
 */
import { type } from "./imports";
/**
 * 用途：引入工作空间菜单入口 workspaceMenu，用于 executeMainMenuNavigationWindowKeyCommand 执行器展示主菜单。
 * 使用范围：仅当前文件 executeMainMenuNavigationWindowKeyCommand 函数中调用。
 * 解耦评估：workspaceMenu 从 menus/workspace 导出，通过 ./imports 间接引用；保持与项目一致的导入方式。
 */
import { workspaceMenu } from "./imports";
/**
 * 用途：引入导航子集委托回退路径的执行器 executeNavigationDelegatedFallbackWindowKeyCommand，当 editKeydown/fileTreeKeydown/panelTreeKeydown 均未命中时降级执行。
 * 使用范围：仅当前文件 executeDelegatedKeydownNavigationWindowKeyCommand 函数中调用。
 * 解耦评估：属同层模块间职责拆分，回退逻辑提取至独立文件避免 navigation.ts 过度膨胀，调用链清晰。
 */
import { executeNavigationDelegatedFallbackWindowKeyCommand } from "./navigation.delegatedFallback";


/** 获取工作空间按钮 DOM 元素，用于 executeMainMenuNavigationWindowKeyCommand 中计算菜单位置。 */
const getWorkspaceButton = () => {
    const workspaceButton = document.querySelector("#barWorkspace");
    if (workspaceButton instanceof HTMLElement) {
        return workspaceButton;
    }
    return null;
};

/**
 * 工厂函数：创建通过 execByCommand 执行标签页关闭命令（closeTab/closeOthers/closeAll/closeUnmodified/closeLeft/closeRight）的异步处理器。
 * 调用时机：在 tabExecNavigationWindowKeyCommandRouter 路由链中按命令匹配后调用。
 */
const createExecByCommandWindowKeyHandler = (command: "closeTab" | "closeOthers" | "closeAll" | "closeUnmodified" | "closeLeft" | "closeRight") => async (state: WindowKeyDownState) => {
    execByCommand({ command });
    state.event.preventDefault();
    return true;
};

/**
 * 工厂函数：创建通过 execByCommand 执行需要 app 实例的命令（recentClosed/replace/globalSearch/search）的异步处理器。
 * 调用时机：在 navigationWindowKeyCommandRouter 路由链中按命令匹配后调用，或由 createExecByCommandWindowKeyHandler 派生子执行器。
 */
const createExecByCommandWithAppWindowKeyHandler = (command: "recentClosed" | "replace" | "globalSearch" | "search") => async (state: WindowKeyDownState) => {
    execByCommand({ command, app: state.app });
    state.event.preventDefault();
    return true;
};

/**
 * 工厂函数：创建按索引切换标签页的异步处理器。
 * 调用时机：在 tabSwitchNavigationWindowKeyCommandRouter 路由链中按命令匹配后调用。
 * 注意：tabIndex=-1 表示最后一个标签页，-2 表示上一个，-3 表示下一个。
 */
const createSwitchTabByIndexWindowKeyHandler = (tabIndex: number) => async (state: WindowKeyDownState) => {
    switchTabByIndex(tabIndex);
    state.event.preventDefault();
    return true;
};

/**
 * 工厂函数：创建通过 globalCommand 执行布局子命令（splitLR/splitTB 等）的异步处理器。
 * 调用时机：在 layoutNavigationWindowKeyCommandRouter 路由链中按命令匹配后调用。
 */
const createLayoutWindowKeyHandler = (command: "splitLR" | "splitMoveR" | "splitTB" | "tabToWindow" | "splitMoveB" | "stickSearch" | "unsplit" | "unsplitAll") => async (state: WindowKeyDownState) => {
    globalCommand(command, state.app);
    state.event.preventDefault();
    return true;
};

/**
 * 执行委托键盘预处理链：按优先级依次尝试 editKeydown → fileTreeKeydown → panelTreeKeydown，任一命中即返回 true。
 * 调用时机：executeDelegatedKeydownNavigationWindowKeyCommand 中，降级到回退路径前先执行预处理。
 */
const executeDelegatedKeydownPreHandlers = (state: WindowKeyDownState) => {
    const targetIsBottomBacklink = hasClosestByClassName(
        state.event.target as HTMLElement,
        "sy__backlink--bottom",
        true,
    ) !== null;
    const preHandlers = [
        () => editKeydown(state.app, state.event),
        () => !state.isTabWindow && fileTreeKeydown(state.app, state.event),
        () => (!state.isTabWindow || targetIsBottomBacklink) && panelTreeKeydown(state.app, state.event),
    ];
    for (const preHandler of preHandlers) {
        if (preHandler()) {
            return true;
        }
    }
    return false;
};

/**
 * 执行主菜单导航命令：获取 workspaceButton 位置后打开工作空间菜单。
 * 调用时机：navigationWindowKeyCommandRouter 命中 MAIN_MENU 命令时。
 */
const executeMainMenuNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    const workspaceButton = getWorkspaceButton();
    if (!workspaceButton) {
        return false;
    }
    workspaceMenu(state.app, workspaceButton.getBoundingClientRect());
    state.event.preventDefault();
    return true;
};

/** 执行前进导航命令：调用 goForward 实现历史前进。命中 GO_FORWARD 命令时调用。 */
const executeGoForwardNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    goForward(state.app);
    state.event.preventDefault();
    return true;
};

/** 执行后退导航命令：调用 goBack 实现历史后退。命中 GO_BACK 命令时调用。 */
const executeGoBackNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    goBack(state.app);
    state.event.preventDefault();
    return true;
};

const executeRecentClosedNavigationWindowKeyCommand = createExecByCommandWithAppWindowKeyHandler("recentClosed");
const executeCloseTabNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeTab");
const executeCloseOthersNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeOthers");
const executeCloseAllNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeAll");
const executeCloseUnmodifiedNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeUnmodified");
const executeCloseLeftNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeLeft");
const executeCloseRightNavigationWindowKeyCommand = createExecByCommandWindowKeyHandler("closeRight");
const executeGoToTab1NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(0);
const executeGoToTab2NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(1);
const executeGoToTab3NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(2);
const executeGoToTab4NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(3);
const executeGoToTab5NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(4);
const executeGoToTab6NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(5);
const executeGoToTab7NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(6);
const executeGoToTab8NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(7);
const executeGoToTab9NavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(-1);
const executeGoToTabNextNavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(-3);
const executeGoToTabPrevNavigationWindowKeyCommand = createSwitchTabByIndexWindowKeyHandler(-2);
const executeSplitLRNavigationWindowKeyCommand = createLayoutWindowKeyHandler("splitLR");
const executeSplitMoveRNavigationWindowKeyCommand = createLayoutWindowKeyHandler("splitMoveR");
const executeSplitTBNavigationWindowKeyCommand = createLayoutWindowKeyHandler("splitTB");
const executeTabToWindowNavigationWindowKeyCommand = createLayoutWindowKeyHandler("tabToWindow");
const executeSplitMoveBNavigationWindowKeyCommand = createLayoutWindowKeyHandler("splitMoveB");
const executeStickSearchNavigationWindowKeyCommand = createLayoutWindowKeyHandler("stickSearch");
const executeUnsplitNavigationWindowKeyCommand = createLayoutWindowKeyHandler("unsplit");
const executeUnsplitAllNavigationWindowKeyCommand = createLayoutWindowKeyHandler("unsplitAll");

/**
 * 执行委托键盘导航命令：先尝试委托预处理链（editKeydown/fileTreeKeydown/panelTreeKeydown），
 * 均未命中时降级至 navigation.delegatedFallback.ts 处理回退命令。
 * 调用时机：navigationWindowKeyCommandRouter 的 remain 兜底路径。
 */
const executeDelegatedKeydownNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    if (executeDelegatedKeydownPreHandlers(state)) {
        return true;
    }
    return executeNavigationDelegatedFallbackWindowKeyCommand(state);
};

const tabExecNavigationWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_TAB}'` }), () => executeCloseTabNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_OTHERS}'` }), () => executeCloseOthersNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_ALL}'` }), () => executeCloseAllNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_UNMODIFIED}'` }), () => executeCloseUnmodifiedNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_LEFT}'` }), () => executeCloseLeftNavigationWindowKeyCommand)
    .remain(() => executeCloseRightNavigationWindowKeyCommand)
    .build();

const tabSwitchNavigationWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_1}'` }), () => executeGoToTab1NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_2}'` }), () => executeGoToTab2NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_3}'` }), () => executeGoToTab3NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_4}'` }), () => executeGoToTab4NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_5}'` }), () => executeGoToTab5NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_6}'` }), () => executeGoToTab6NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_7}'` }), () => executeGoToTab7NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_8}'` }), () => executeGoToTab8NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_9}'` }), () => executeGoToTab9NavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_NEXT}'` }), () => executeGoToTabNextNavigationWindowKeyCommand)
    .remain(() => executeGoToTabPrevNavigationWindowKeyCommand)
    .build();

const layoutNavigationWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_LR}'` }), () => executeSplitLRNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_R}'` }), () => executeSplitMoveRNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_TB}'` }), () => executeSplitTBNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.TAB_TO_WINDOW}'` }), () => executeTabToWindowNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_B}'` }), () => executeSplitMoveBNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.STICK_SEARCH}'` }), () => executeStickSearchNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.UNSPLIT}'` }), () => executeUnsplitNavigationWindowKeyCommand)
    .remain(() => executeUnsplitAllNavigationWindowKeyCommand)
    .build();

const navigationWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.MAIN_MENU}'` }), () => executeMainMenuNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_FORWARD}'` }), () => executeGoForwardNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_BACK}'` }), () => executeGoBackNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.RECENT_CLOSED}'` }), () => executeRecentClosedNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_TAB}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_OTHERS}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_ALL}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_UNMODIFIED}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_LEFT}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.CLOSE_RIGHT}'` }), ({ command }: { command: string }) => tabExecNavigationWindowKeyCommandRouter({ command }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_1}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_2}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_3}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_4}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_5}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_6}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_7}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_8}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_9}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_NEXT}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.GO_TO_TAB_PREV}'` }), ({ command }: { command: string }) => tabSwitchNavigationWindowKeyCommandRouter({ command }))
    .split(type({ command: `'${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_LR}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_R}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_TB}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.TAB_TO_WINDOW}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.SPLIT_MOVE_B}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.STICK_SEARCH}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.UNSPLIT}' | '${NAVIGATION_WINDOW_KEY_COMMANDS.UNSPLIT_ALL}'` }), ({ command }: { command: string }) => layoutNavigationWindowKeyCommandRouter({ command }))
    .remain(() => executeDelegatedKeydownNavigationWindowKeyCommand)
    .build();

/**
 * 导航子集命令入口：通过 navigationWindowKeyCommandRouter 匹配命令并派发至对应执行器。
 * 调用时机：subset/index.ts 中根路由命中 navigation 域后调用。
 */
export const executeNavigationWindowKeyCommand = async (command: NavigationWindowKeyCommand, state: WindowKeyDownState) => {
    const executor = navigationWindowKeyCommandRouter({ command });
    return executor(state);
};
