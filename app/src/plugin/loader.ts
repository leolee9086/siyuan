/* eslint-disable folder-item-limit/folder-item-limit */
/** @导入用途: 拉取插件清单接口 @使用范围: loadPlugins/reloadPlugin @解耦评估: 通过 imports 网关转发，避免父级路径耦合 */
import {fetchSyncPost} from "../util/network/fetch";
/** @导入用途: 应用实例类型 @使用范围: 导出函数参数标注 @解耦评估: 插件加载器核心上下文，无法解耦 */
import type {AppFacade} from "../app/AppFacade.types";
/** @导入用途: 插件基类 @使用范围: loadPluginJS 继承校验 @解耦评估: 插件协议核心依赖，无法解耦 */
import {Plugin} from "./index";
/** @导入用途: 布局持久化 @使用范围: loadPlugin/reloadPlugin 完成后保存布局 @解耦评估: 事件化可行但当前直接调用更可控 */
import {saveLayout} from "../layout/persistence/saveLayout";
/** @导入用途: 插件 API 注入对象 @使用范围: requireFunc 返回 siyuan 模块 @解耦评估: 运行时契约依赖，无法解耦 */
import {API} from "./API";
/** @导入用途: 前端类型检测 @使用范围: 加载插件请求参数 frontend @解耦评估: 环境判断工具，已走 imports 网关 */
import {getFrontend} from "../util/platform/functions";
/** @导入用途: 移动端检测 @使用范围: afterLoadPlugin 分支判断 @解耦评估: 工具函数依赖，保持轻量直接调用 */
import {isMobile} from "../util/platform/functions";
/** @导入用途: 插件卸载流程 @使用范围: reloadPlugin 重载前清理旧实例 @解耦评估: 生命周期核心流程，无法解耦 */
import {uninstall} from "./uninstall";
/** @导入用途: 获取所有编辑器实例 @使用范围: 插件变更后刷新工具栏 @解耦评估: 当前工具函数访问最直接 */
import {getAllEditor} from "../layout/getAll";
/** @导入用途: 访问宿主 require @使用范围: 构建插件 CommonJS require @解耦评估: window 访问已下沉到 environment 层 */
import {getPluginRuntimeRequire} from "./API.environment";
/** @导入用途: 执行插件代码字符串 @使用范围: 生成插件入口执行函数 @解耦评估: 高风险 API 已封装到 environment 层 */
import {evaluatePluginCode} from "./API.environment";
/** @导入用途: 插件加载后 UI 挂载流程 @使用范围: afterLoadPlugin 委托执行 @解耦评估: 通过模块拆分降低 loader.ts 复杂度 */
import {runAfterLoadPlugin} from "./loader.afterLoad";
/** @导入用途: 插件停靠栏动态添加 @使用范围: 插件初始化时挂载 UI @解耦评估: 通过模块拆分降低 loader.ts 复杂度 */
import {addPluginDock} from "./loader.afterLoad";
/** @导入用途: Plugin 宿主运行时契约 @使用范围: 构造器能力注入 @解耦评估: 纯类型不反向依赖 Plugin class */
import type * as Siyuan from "siyuan";

const pluginLoadPromises = new WeakMap<Siyuan.Plugin, Promise<void>>();

/** 作用: 构建插件 require 注入层; 意图: 统一第三方插件模块解析; 调用时机: 插件入口执行时 */
const requireFunc = (key: string) => {
    const modules: Record<string, unknown> = {siyuan: API};
    const moduleValue = modules[key];
    if (moduleValue) {
        return moduleValue;
    }
    const runtimeRequire = getPluginRuntimeRequire();
    return runtimeRequire?.(key);
};

/** 作用: 继承宿主 require 原型; 意图: 保持插件运行时兼容; 调用时机: 模块初始化阶段 */
const initializeRequirePrototype = () => {
    const runtimeRequire = getPluginRuntimeRequire();
    if (!(runtimeRequire instanceof Function)) {
        return;
    }
    Object.setPrototypeOf(requireFunc, runtimeRequire);
};

initializeRequirePrototype();

/** 作用: 包装插件源码为 CommonJS 函数; 意图: 统一执行格式并附加 sourceURL; 调用时机: loadPluginJS 内 */
const createPluginRunner = (code: string, sourceURL: string) => {
    const wrappedCode = "(function anonymous(require, module, exports){".concat(code, "\n})\n//# sourceURL=").concat(sourceURL, "\n");
    return evaluatePluginCode(wrappedCode);
};

/** 作用: 获取插件样式锚点; 意图: 保证 CSS 插入顺序稳定; 调用时机: 插件 CSS 注入前 */
const getPluginsStyle = () => {
    let pluginsStyle = document.getElementById("pluginsStyle");
    if (!pluginsStyle) {
        pluginsStyle = document.createElement("style");
        pluginsStyle.id = "pluginsStyle";
        document.head.append(pluginsStyle);
    }
    return pluginsStyle;
};

/** 作用: 注入插件 CSS; 意图: 确保插件样式即时生效; 调用时机: 插件 JS 加载前（上游调整），避免 onload 里插入的 DOM 先按无样式排版 */
const insertPluginCSS = (item: IPluginData, pluginsStyle: HTMLElement) => {
    if (!item.css) {
        return;
    }
    const styleElement = document.createElement("style");
    styleElement.id = "pluginsStyle" + item.name;
    styleElement.textContent = item.css;
    pluginsStyle.insertAdjacentElement("afterend", styleElement);
};

/** 作用: 刷新所有编辑器工具栏; 意图: 插件变更后同步 UI 状态; 调用时机: loadPlugin/reloadPlugin 后 */
const refreshAllEditorToolbars = () => {
    const editors = getAllEditor();
    for (const editor of editors) {
        editor.protyle.toolbar?.update(editor.protyle);
    }
};

/** 处理 Plugin.onDataChanged 的既有卸载、重载、挂载和工具栏刷新时序。 */
export const reloadPluginData = (app: AppFacade, sourcePlugin: Siyuan.Plugin) => {
    uninstall(app, sourcePlugin.name, true);
    void loadPlugins(app, [sourcePlugin.name], false).then(() => {
        app.plugins.find((plugin) => {
            if (sourcePlugin.name !== plugin.name) {
                return false;
            }
            afterLoadPlugin(plugin);
            for (const editor of getAllEditor()) {
                editor.protyle.toolbar.update(editor.protyle);
            }
            return true;
        });
    });
};

/** 作用: 校验并返回插件实例; 意图: 统一构造结果合法性检查; 调用时机: loadPluginJS 中构造后 */
const getValidatedPluginInstance = (pluginInstance: unknown, pluginName: string) => {
    const isValidPlugin = pluginInstance instanceof Plugin;
    if (!isValidPlugin) {
        console.error(`plugin ${pluginName} construct failed`);
        return;
    }
    return pluginInstance;
};

/** 作用: 执行单插件入口并实例化; 意图: 把导出模块转成 Plugin 实例; 调用时机: 批量/单个加载 */
const loadPluginJS = async (app: AppFacade, item: IPluginData) => {
    const exportsObj: Record<string, unknown> = {};
    const moduleObj: { exports: unknown } = {exports: exportsObj};

    try {
        const runner = createPluginRunner(item.js, "plugin:" + encodeURIComponent(item.name));
        runner(requireFunc, moduleObj, exportsObj);
    } catch (error) {
        console.error(`plugin ${item.name} run error:`, error);
        return;
    }

    const defaultExport = Reflect.get(Object(moduleObj.exports), "default");
    const pluginClass = defaultExport || moduleObj.exports;
    const hasExportFunction = typeof pluginClass === "function";
    if (!hasExportFunction) {
        console.error(`plugin ${item.name} has no export`);
        return;
    }

    const pluginPrototype = Reflect.get(pluginClass, "prototype");
    const extendsPlugin = pluginPrototype instanceof Plugin;
    if (!extendsPlugin) {
        console.error(`plugin ${item.name} does not extends Plugin`);
        return;
    }

    const pluginInstance = Reflect.construct(pluginClass, [{
        app,
        displayName: item.displayName,
        name: item.name,
        i18n: item.i18n,
    }]);
    const validPlugin = getValidatedPluginInstance(pluginInstance, item.name);
    if (!validPlugin) {
        return;
    }

    app.plugins.push(validPlugin);
    const loadPromise = (async () => {
        try {
            await validPlugin.onload();
        } catch (error) {
            console.error(`plugin ${item.name} onload error:`, error);
        }
        await validPlugin.kernel.init();
    })();
    pluginLoadPromises.set(validPlugin, loadPromise);
    await loadPromise;
    return validPlugin;
};

/** @导出说明: 批量加载插件入口 */
/** 作用: 批量加载插件并注入样式; 意图: 统一初始化与增量加载; 调用时机: 启动和重载流程 */
export const loadPlugins = async (app: AppFacade, names?: string[], init = true) => {
    const response = await fetchSyncPost("/api/petal/loadPetals", {frontend: getFrontend()});
    const pluginsStyle = getPluginsStyle();
    const pluginItems: IPluginData[] = Array.isArray(response.data) ? response.data : [];

    for (const item of pluginItems) {
        const shouldLoad = !names || names.includes(item.name);
        if (!shouldLoad) {
            continue;
        }
        // 先插入 CSS，避免 onload 里插入的 DOM 在样式生效前先按无样式排版
        insertPluginCSS(item, pluginsStyle);
        if (init) {
            void loadPluginJS(app, item).catch((error) => {
                console.error(`plugin ${item.name} initialization error:`, error);
            });
        }
        if (!init) {
            await loadPluginJS(app, item);
        }
    }
};

/** @导出说明: 启用单个插件入口 */
/** 作用: 启用单插件并触发后续 UI 初始化; 意图: 支持插件管理中的手动启用; 调用时机: 用户启用插件 */
export const loadPlugin = async (app: AppFacade, item: IPluginData) => {
    // 先插入 CSS，避免 onload 里插入的 DOM 在样式生效前先按无样式排版
    insertPluginCSS(item, getPluginsStyle());
    const plugin = await loadPluginJS(app, item);
    if (!plugin) {
        return;
    }
    afterLoadPlugin(plugin);
    saveLayout();
    refreshAllEditorToolbars();
    return plugin;
};

/** @同步豁免: UI构建 */
/** @导出说明: 插件加载后 UI 初始化入口 */
/** 作用: 统一执行布局回调与图标/Dock 挂载; 意图: 保持插件加载后时序一致; 调用时机: loadPlugin/reloadPlugin 后 */
/** 作用：等待插件初始化完成后挂载其界面；意图：保持异步加载与布局就绪顺序；调用时机：单插件加载或重载完成后。 */
export const afterLoadPlugin = (plugin: Siyuan.Plugin) => {
    runAfterLoadPlugin(plugin);
    return;
};

/** 作用：通知已加载插件布局就绪；意图：把插件生命周期回调延迟到布局可用之后；调用时机：主布局初始化完成时。 */
export const afterLayoutReady = (app: AppFacade) => {
    for (const plugin of app.plugins) {
        const loadPromise = pluginLoadPromises.get(plugin);
        if (!loadPromise) {
            afterLoadPlugin(plugin);
            continue;
        }
        void loadPromise.then(() => {
            afterLoadPlugin(plugin);
        }).catch((error) => {
            console.error(`plugin ${plugin.name} layout initialization error:`, error);
        });
    }
};
/** 导出 addPluginDock 供插件系统外部模块使用 */
export { addPluginDock };

/** 作用: 按名称批量卸载插件; 意图: 复用 reloadPlugin 前置清理; 调用时机: reloadPlugin 内 */
const uninstallPluginsByNames = (app: AppFacade, names: string[], disabled: boolean) => {
    for (const name of names) {
        uninstall(app, name, disabled);
    }
};

// S-forge: addPluginDock 已拆分到 loader.afterLoad.ts，上游 #18003 移动端逻辑已移植到该子模块
/** 作用: 处理代码更新插件; 意图: 重挂 UI 并刷新工具栏; 调用时机: reloadPlugin 加载代码后 */
const handleUpsertCodePlugins = (app: AppFacade, upsertCodePlugins: string[]) => {
    for (const plugin of app.plugins) {
        const shouldHandle = upsertCodePlugins.includes(plugin.name);
        if (!shouldHandle) {
            continue;
        }
        afterLoadPlugin(plugin);
        refreshAllEditorToolbars();
    }
};

/** 作用: 处理数据更新插件; 意图: 触发生命周期 onDataChanged; 调用时机: reloadPlugin 末段 */
const handleUpsertDataPlugins = (app: AppFacade, upsertDataPlugins: string[]) => {
    for (const plugin of app.plugins) {
        const shouldHandle = upsertDataPlugins.includes(plugin.name);
        if (!shouldHandle) {
            continue;
        }
        try {
            plugin.onDataChanged();
        } catch (error) {
            console.error(`plugin ${plugin.name} onDataChanged error:`, error);
        }
    }
};

/** @导出说明: 插件重载入口 */
/** 作用: 执行禁用/卸载/重载/数据通知; 意图: 提供热更新能力; 调用时机: 插件安装更新或调试重载时 */
export const reloadPlugin = async (app: AppFacade, data: {
    uninstallPlugins?: string[],  // 插件卸载
    unloadPlugins?: string[],     // 插件禁用
    reloadPlugins?: string[],     // 插件启用，或插件代码变更
    dataChangePlugins?: string[], // 插件存储数据变更
} = {}) => {
    const {
        uninstallPlugins = [],
        unloadPlugins = [],
        reloadPlugins = [],
        dataChangePlugins = []
    } = data;

    uninstallPluginsByNames(app, unloadPlugins, true);
    uninstallPluginsByNames(app, uninstallPlugins, false);
    uninstallPluginsByNames(app, reloadPlugins, true);

    await loadPlugins(app, reloadPlugins, false);
    handleUpsertCodePlugins(app, reloadPlugins);
    handleUpsertDataPlugins(app, dataChangePlugins);

    if (isMobile()) {
        return;
    }
    saveLayout();
};
