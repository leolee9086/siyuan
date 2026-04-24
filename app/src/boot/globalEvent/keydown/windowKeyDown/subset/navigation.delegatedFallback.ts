
/**
 * 用途：处理导航子集中委托回退（delegated fallback）路径的键盘事件命令。
 * 当 navigation.ts 中的主要导航命令（tab切换、关闭、布局等）均未命中时，
 * 降级至此文件处理 pluginCommand、replace、globalSearch、search、save 等回退命令。
 * 使用范围：仅供 subset/navigation.ts 中 executeDelegatedKeydownNavigationWindowKeyCommand 调用。
 * 解耦评估：当前文件是导航子集处理阶段的最后一级托底，职责明确只处理回退场景，
 * 不参与 facts 判断，保持"路由导航 → 子集处理 → 回退执行"的单向流程。
 */

/**
 * 用途：导入统一状态类型 WindowKeyDownState，供所有执行器函数签名使用。
 * 使用范围：仅当前文件内的执行器函数签名。
 * 解耦评估：纯类型导入，编译期完全擦除，不产生运行时耦合。
 */
import type { WindowKeyDownState } from "./imports";
/**
 * 用途：导入声明式状态路由 DSL calibur，用于构建多级委托回退状态路由链。
 * 使用范围：仅当前文件内的 calibur 路由链定义。
 * 解耦评估：DSL 定义必须在模块作用域静态声明，无法通过参数注入或事件发射替代。
 */
import { calibur } from "./imports";
/**
 * 用途：导入命令执行入口 execByCommand，用于落地 replace/globalSearch/search 命令。
 * 使用范围：仅当前文件 createExecByCommandWithAppWindowKeyHandler 工厂内调用。
 * 解耦评估：execByCommand 是全局命令调度入口，当前通过导入调用；理论上可通过参数传入，
 * 但考虑到该入口在项目中被广泛通过导入使用且是单例调度器，保持现有导入方式与项目约定一致。
 */
import { execByCommand } from "./imports";
/**
 * 用途：导入 arktype 运行时类型守卫，用于 calibur 路由 split 分支的条件匹配。
 * 使用范围：仅当前文件内的 calibur 路由链分叉条件定义。
 * 解耦评估：arktype 是 calibur-router 的路由条件 DSL 的基础组件，必须静态导入。
 */
import { type } from "./imports";

const NAVIGATION_DELEGATED_FALLBACK_COMMANDS = {
    IGNORE: "ignore",
    PLUGIN_COMMAND: "pluginCommand",
    REPLACE: "replace",
    GLOBAL_SEARCH: "globalSearch",
    SEARCH: "search",
    SAVE: "save",
} as const;

/**
 * 从状态中提取 pluginCommand 回调，不存在时抛出明确异常。
 * 调用时机：executePluginCommandDelegatedFallbackNavigationWindowKeyCommand 中解包使用。
 */
const resolvePluginCommand = (state: WindowKeyDownState) => {
    if (state.pluginCommand) {
        return state.pluginCommand;
    }
    throw new Error("windowKeyDown navigation delegated fallback expected pluginCommand");
};

/**
 * 工厂函数：创建通过 execByCommand 执行导航命令的异步处理器。
 * 用于生成 replace / globalSearch / search 三个命令的高阶执行器，减少重复模板代码。
 */
const createExecByCommandWithAppWindowKeyHandler = (command: "replace" | "globalSearch" | "search") => async (state: WindowKeyDownState) => {
    execByCommand({ command, app: state.app });
    state.event.preventDefault();
    return true;
};

const delegatedFallbackSaveWindowKeyStateRouter = calibur
    .universe(type({
        hasPluginCommand: "boolean",
        navigation: {
            replaceHotkey: "boolean",
            globalSearchHotkey: "boolean",
            searchHotkey: "boolean",
            saveHotkey: "boolean",
        },
    }))
    .split(type({ navigation: { saveHotkey: "true" } }), () => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.SAVE)
    .remain(() => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.IGNORE)
    .build();

const delegatedFallbackSearchWindowKeyStateRouter = calibur
    .universe(type({
        hasPluginCommand: "boolean",
        navigation: {
            replaceHotkey: "boolean",
            globalSearchHotkey: "boolean",
            searchHotkey: "boolean",
            saveHotkey: "boolean",
        },
    }))
    .split(type({ navigation: { searchHotkey: "true" } }), () => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.SEARCH)
    .remain(state => delegatedFallbackSaveWindowKeyStateRouter(state))
    .build();

const delegatedFallbackGlobalSearchWindowKeyStateRouter = calibur
    .universe(type({
        hasPluginCommand: "boolean",
        navigation: {
            replaceHotkey: "boolean",
            globalSearchHotkey: "boolean",
            searchHotkey: "boolean",
            saveHotkey: "boolean",
        },
    }))
    .split(type({ navigation: { globalSearchHotkey: "true" } }), () => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.GLOBAL_SEARCH)
    .remain(state => delegatedFallbackSearchWindowKeyStateRouter(state))
    .build();

const delegatedFallbackReplaceWindowKeyStateRouter = calibur
    .universe(type({
        hasPluginCommand: "boolean",
        navigation: {
            replaceHotkey: "boolean",
            globalSearchHotkey: "boolean",
            searchHotkey: "boolean",
            saveHotkey: "boolean",
        },
    }))
    .split(type({ navigation: { replaceHotkey: "true" } }), () => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.REPLACE)
    .remain(state => delegatedFallbackGlobalSearchWindowKeyStateRouter(state))
    .build();

const delegatedFallbackWindowKeyStateRouter = calibur
    .universe(type({
        hasPluginCommand: "boolean",
        navigation: {
            replaceHotkey: "boolean",
            globalSearchHotkey: "boolean",
            searchHotkey: "boolean",
            saveHotkey: "boolean",
        },
    }))
    .split(type({ hasPluginCommand: "true" }), () => NAVIGATION_DELEGATED_FALLBACK_COMMANDS.PLUGIN_COMMAND)
    .remain(state => delegatedFallbackReplaceWindowKeyStateRouter(state))
    .build();

/** 忽略命令的空执行器，直接返回 false 表示未处理。 */
const executeIgnoredDelegatedFallbackNavigationWindowKeyCommand = async () => false;

/**
 * 执行插件命令：调用 pluginCommand.callback() 并阻止事件冒泡与默认行为。
 * 调用时机：状态路由链命中 hasPluginCommand=true 时。
 */
const executePluginCommandDelegatedFallbackNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    const pluginCommand = resolvePluginCommand(state);
    pluginCommand.callback();
    state.event.stopPropagation();
    state.event.preventDefault();
    return true;
};

const executeReplaceDelegatedFallbackNavigationWindowKeyCommand = createExecByCommandWithAppWindowKeyHandler("replace");

const executeGlobalSearchDelegatedFallbackNavigationWindowKeyCommand = createExecByCommandWithAppWindowKeyHandler("globalSearch");

const executeSearchDelegatedFallbackNavigationWindowKeyCommand = createExecByCommandWithAppWindowKeyHandler("search");

/**
 * 保存命令执行器：阻止事件默认行为并返回 true。
 * 说明：保存操作由编辑器自身的 Ctrl+S 快捷键处理，此处仅阻止浏览器默认行为（如"另存为"对话框），
 * 避免干扰编辑器的正常保存流程。
 */
const executeSaveDelegatedFallbackNavigationWindowKeyCommand = async (state: WindowKeyDownState) => {
    state.event.preventDefault();
    return true;
};

const delegatedFallbackWindowKeyCommandRouter = calibur
    .universe(type({ command: "string" }))
    .split(type({ command: `'${NAVIGATION_DELEGATED_FALLBACK_COMMANDS.IGNORE}'` }), () => executeIgnoredDelegatedFallbackNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_DELEGATED_FALLBACK_COMMANDS.PLUGIN_COMMAND}'` }), () => executePluginCommandDelegatedFallbackNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_DELEGATED_FALLBACK_COMMANDS.REPLACE}'` }), () => executeReplaceDelegatedFallbackNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_DELEGATED_FALLBACK_COMMANDS.GLOBAL_SEARCH}'` }), () => executeGlobalSearchDelegatedFallbackNavigationWindowKeyCommand)
    .split(type({ command: `'${NAVIGATION_DELEGATED_FALLBACK_COMMANDS.SEARCH}'` }), () => executeSearchDelegatedFallbackNavigationWindowKeyCommand)
    .remain(() => executeSaveDelegatedFallbackNavigationWindowKeyCommand)
    .build();

/**
 * 导航子集回退命令入口：通过两级路由链（状态路由 → 命令路由）匹配并执行回退命令。
 * 状态路由链顺序：hasPluginCommand → navigation.replaceHotkey → navigation.globalSearchHotkey → navigation.searchHotkey → navigation.saveHotkey。
 * 命令路由链：ignore → pluginCommand → replace → globalSearch → search → save。
 * 调用时机：navigation.ts 中 delegated keydown 预处理（editKeydown/fileTreeKeydown/panelTreeKeydown）均未命中时，
 * 由 executeDelegatedKeydownNavigationWindowKeyCommand 调用。
 */
export const executeNavigationDelegatedFallbackWindowKeyCommand = async (state: WindowKeyDownState) => {
    const command = delegatedFallbackWindowKeyStateRouter({
        hasPluginCommand: !!state.pluginCommand,
        navigation: {
            replaceHotkey: state.navigation.replaceHotkey,
            globalSearchHotkey: state.navigation.globalSearchHotkey,
            searchHotkey: state.navigation.searchHotkey,
            saveHotkey: state.navigation.saveHotkey,
        },
    });
    const executor = delegatedFallbackWindowKeyCommandRouter({ command });
    return executor(state);
};
