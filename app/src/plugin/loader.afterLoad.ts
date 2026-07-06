/* eslint-disable folder-item-limit/folder-item-limit */
/** @导入用途: 插件基类类型 @使用范围: afterLoad 相关函数签名 @解耦评估: 插件生命周期核心依赖不可解耦 */
import {Plugin} from "./index";
/** @导入用途: 移动端检测 @使用范围: 顶栏/状态栏/Dock 分支 @解耦评估: 环境工具函数，直接调用最轻量 */
import {isMobile} from "./imports";
/** @导入用途: 独立窗口检测 @使用范围: 顶栏与 Dock 条件分支 @解耦评估: 环境工具函数，当前方案已足够解耦 */
import {isWindow} from "./imports";
/** @导入用途: 顶栏重算函数 @使用范围: 状态栏图标挂载后刷新布局 @解耦评估: UI 工具函数直接调用更清晰 */
import {resizeTopBar} from "./imports";
/** @导入用途: 常量键集合 @使用范围: 本地存储键读取与写入 @解耦评估: 常量依赖无法进一步解耦 */
import {Constants} from "./imports";
/** @导入用途: 设置页签菜单 ID 映射 @使用范围: 移动端插件顶栏图标挂载位置 @解耦评估: 通过 imports 网关统一路径 */
import {settingTabToMenuId} from "./imports";
/** @导入用途: 存储写入函数 @使用范围: Dock 配置持久化 @解耦评估: 已通过 imports 网关隔离路径耦合 */
import {setStorageVal} from "./imports";
/** @导入用途: 读取思源配置 @使用范围: 同步布局中的 Dock 数据 @解耦评估: 全局配置访问已收敛到环境层 */
import {getSiyuanConfig} from "./imports";
/** @导入用途: 读取思源存储 @使用范围: 顶栏显隐和 Dock 状态恢复 @解耦评估: 全局存储访问已封装 */
import {getSiyuanStorage} from "./imports";
/** @导入用途: 读取思源布局 @使用范围: Dock 按钮挂载 @解耦评估: 布局访问通过环境层提供，边界清晰 */
import {getSiyuanLayout} from "./imports";
/** @导入用途: 读取插件快捷键 @使用范围: Dock 按钮 hotkey 字段填充 @解耦评估: 配置访问集中在环境层 */
import {getPluginCustomHotkey} from "./imports";

/** 作用: 根据区域生成 Dock 位置; 意图: 收敛位置映射逻辑; 调用时机: updateDock 中 */
const resolveDockPosition = (type: string, index: number) => {
    if (type === "Left") {
        return index === 0 ? "LeftTop" : "LeftBottom";
    }
    if (type === "Right") {
        return index === 0 ? "RightTop" : "RightBottom";
    }
    return index === 0 ? "BottomLeft" : "BottomRight";
};

/** 作用: 同步单个区域 Dock 配置; 意图: 保持插件 dock 与布局一致; 调用时机: 布局恢复阶段 */
const updateDock = (dockItems: Config.IUILayoutDockTab[], index: number, plugin: Plugin, type: string) => {
    const docks = plugin.docks;
    const dockKeys = Object.keys(docks);
    const storage = getSiyuanStorage();
    const pluginDocksStorage = storage[Constants.LOCAL_PLUGIN_DOCKS];
    if (!pluginDocksStorage) {
        return;
    }

    let currentPluginStorage = pluginDocksStorage[plugin.name];
    if (!currentPluginStorage) {
        currentPluginStorage = {};
        pluginDocksStorage[plugin.name] = currentPluginStorage;
    }

    for (let tabIndex = 0; tabIndex < dockItems.length; tabIndex++) {
        const tabItem = dockItems[tabIndex];
        if (!tabItem) {
            continue;
        }
        const dockType = tabItem.type;
        const hasDock = dockKeys.includes(dockType);
        if (!hasDock) {
            continue;
        }
        const dock = docks[dockType];
        if(!dock){
            return;
        }
        const dockConfig = dock.config;
        dockConfig.position = resolveDockPosition(type, index);
        dockConfig.index = tabIndex;
        dockConfig.show = tabItem.show;
        dockConfig.size = tabItem.size;
        currentPluginStorage[dockType] = dockConfig;
    }

    setStorageVal(Constants.LOCAL_PLUGIN_DOCKS, pluginDocksStorage);
};

/** 作用: 移动端挂载顶栏图标; 意图: 遵守用户固定设置; 调用时机: appendTopBarIcon 的移动端分支 */
const appendMobileTopBarIcon = (element: Element) => {
    const storage = getSiyuanStorage();
    const unpinStorage = storage[Constants.LOCAL_PLUGINTOPUNPIN];
    const shouldHide = unpinStorage.includes(element.id);
    if (shouldHide) {
        return;
    }
    const aboutMenu = document.querySelector("#" + settingTabToMenuId("about"));
    if (!(aboutMenu instanceof Element)) {
        return;
    }
    aboutMenu.after(element);
};

/** 作用: 桌面端挂载顶栏图标; 意图: 按位置插入拖拽区或插件区; 调用时机: appendTopBarIcon 的桌面分支 */
const appendDesktopTopBarIcon = (element: Element) => {
    const storage = getSiyuanStorage();
    const unpinStorage = storage[Constants.LOCAL_PLUGINTOPUNPIN];
    const shouldHide = unpinStorage.includes(element.id);
    if (shouldHide) {
        element.classList.add("fn__none");
    }
    const location = element.getAttribute("data-location");
    const targetId = location === "right" ? "barPlugins" : "drag";
    const target = document.querySelector("#" + targetId);
    if (!(target instanceof Element)) {
        return;
    }
    target.before(element);
};

/** 作用: 根据运行形态挂载单个顶栏图标; 意图: 统一顶栏分支入口; 调用时机: mountTopBarIcons 内 */
const appendTopBarIcon = (element: Element) => {
    /** 说明: 移动端图标进入设置“关于”项后方，避免误插入桌面区域 */
    if (isMobile()) {
        appendMobileTopBarIcon(element);
        return;
    }
    if (isWindow()) {
        return;
    }
    appendDesktopTopBarIcon(element);
};

/** 作用: 批量挂载顶栏图标; 意图: 避免重复插入并兼容各端; 调用时机: runAfterLoadPlugin */
const mountTopBarIcons = (plugin: Plugin) => {
    const shouldRenderTopBar = !isWindow() || isMobile();
    if (!shouldRenderTopBar) {
        return;
    }

    for (const element of plugin.topBarIcons) {
        const inDocument = document.contains(element);
        if (inDocument) {
            continue;
        }
        appendTopBarIcon(element);
    }
};

/** 作用: 挂载单个状态栏图标; 意图: 统一左右插入策略; 调用时机: mountStatusBarIcons 内 */
const appendStatusBarIcon = (element: Element) => {
    const statusElement = document.getElementById("status");
    if (!(statusElement instanceof HTMLElement)) {
        return;
    }
    const location = element.getAttribute("data-location");
    /** 说明: 右侧图标追加到尾部，左侧图标插入头部 */
    if (location === "right") {
        statusElement.insertAdjacentElement("beforeend", element);
        return;
    }
    statusElement.insertAdjacentElement("afterbegin", element);
};

/** 作用: 批量挂载状态栏图标; 意图: 插件状态与状态栏同步; 调用时机: runAfterLoadPlugin */
const mountStatusBarIcons = (plugin: Plugin) => {
    if (isMobile()) {
        return;
    }

    for (const element of plugin.statusBarIcons) {
        const inDocument = document.contains(element);
        if (inDocument) {
            continue;
        }
        appendStatusBarIcon(element);
    }
    resizeTopBar();
};

/** 作用: 触发布局就绪回调; 意图: 保护插件生命周期调用; 调用时机: runAfterLoadPlugin 首步 */
const notifyLayoutReady = (plugin: Plugin) => {
    try {
        plugin.onLayoutReady();
    } catch (error) {
        console.error(`plugin ${plugin.name} onLayoutReady error:`, error);
    }
};

/** 作用: 从配置同步三块 Dock 数据; 意图: 恢复插件 Dock 基础位置; 调用时机: mountPluginDocks */
const syncDockConfigFromLayout = (plugin: Plugin) => {
    const uiLayout = getSiyuanConfig().uiLayout;
    const leftData = uiLayout.left.data;
    for (let index = 0; index < leftData.length; index++) {
        const data = leftData[index];
        if (!data) {
            continue;
        }
        updateDock(data, index, plugin, "Left");
    }
    const rightData = uiLayout.right.data;
    for (let index = 0; index < rightData.length; index++) {
        const data = rightData[index];
        if (!data) {
            continue;
        }
        updateDock(data, index, plugin, "Right");
    }
    const bottomData = uiLayout.bottom.data;
    for (let index = 0; index < bottomData.length; index++) {
        const data = bottomData[index];
        if (!data) {
            continue;
        }
        updateDock(data, index, plugin, "Bottom");
    }
};

/** 作用: 应用存储中的 Dock 配置; 意图: 恢复 show/size/index 状态; 调用时机: mountPluginDocks 内 */
const applyStoredDockConfig = (plugin: Plugin, dockKey: string) => {
    const storage = getSiyuanStorage();
    const pluginDocksStorage = storage[Constants.LOCAL_PLUGIN_DOCKS];
    if (!pluginDocksStorage) {
        return;
    }
    const pluginStorage = pluginDocksStorage[plugin.name];
    if (!pluginStorage) {
        return;
    }
    const storedConfig = pluginStorage[dockKey];
    if (!storedConfig) {
        return;
    }
    const dock = plugin.docks[dockKey];
    if (!dock) {
        return;
    }
    dock.config = storedConfig;
};

/** 作用: 生成并挂载单个 Dock 按钮; 意图: 将插件 dock 渲染到对应容器; 调用时机: mountPluginDocks 遍历中 */
const appendDockButton = (dockKey: string, plugin: Plugin) => {
    const dock = plugin.docks[dockKey];
    if (!dock) {
        return;
    }
    const position = dock.config.position;
    const hotkey = getPluginCustomHotkey(plugin.name, dockKey);
    const button = [{
        type: dockKey,
        size: dock.config.size,
        show: dock.config.show ?? false,
        icon: dock.config.icon,
        title: dock.config.title,
        hotkey: hotkey ?? "",
        hotkeyLangId: ""
    }];
    const layout = getSiyuanLayout();
    const leftDock = layout.leftDock;
    const bottomDock = layout.bottomDock;
    const rightDock = layout.rightDock;
    if (position.startsWith("Left")&& leftDock) {
        return leftDock.genButton(button, position === "LeftBottom" ? 1 : 0, dock.config.index);
    }
    if (position.startsWith("Bottom")&& bottomDock) {
        return bottomDock.genButton(button, position === "BottomRight" ? 1 : 0, dock.config.index);
    }
    if (!position.startsWith("Right")|| !rightDock) {
        return;
    }
    rightDock.genButton(button, position === "RightBottom" ? 1 : 0, dock.config.index);
};

/** 作用: 挂载插件 Dock; 意图: 仅在非窗口且非移动端恢复 Dock; 调用时机: runAfterLoadPlugin */
const mountPluginDocks = (plugin: Plugin) => {
    if (isWindow()) {
        return;
    }
    if (isMobile()) {
        return;
    }

    syncDockConfigFromLayout(plugin);
    const dockKeys = Object.keys(plugin.docks);
    for (const dockKey of dockKeys) {
        applyStoredDockConfig(plugin, dockKey);
        appendDockButton(dockKey, plugin);
    }
};

/** @导出说明: 插件加载后 UI 挂载实现 */
/** 作用: 执行布局回调与图标/Dock 挂载; 意图: 从 loader.ts 分离复杂 UI 逻辑; 调用时机: afterLoadPlugin 委托 */
/** @同步豁免: UI构建 */
export const runAfterLoadPlugin = (plugin: Plugin) => {
    notifyLayoutReady(plugin);
    mountTopBarIcons(plugin);
    mountStatusBarIcons(plugin);
    mountPluginDocks(plugin);
};

// S-forge: 上游 #18003 移动端仅在有插件 dock 时显示插件入口图标（本地以运行时 isMobile() 替代条件编译）
/** 作用: 移动端插件声明 dock 时显示侧栏插件入口图标; 意图: 与桌面端 dock 栏对应的移动端入口; 调用时机: addPluginDock 移动端分支 */
const showMobileSidebarPluginTab = (plugin: Plugin) => {
    // 插件未声明 dock 时移动端无需显示侧栏插件入口图标
    if (Object.keys(plugin.docks).length === 0) {
        return;
    }
    const sidebarPluginTab = document.querySelector('#sidebar [data-type="sidebar-plugin-tab"]');
    sidebarPluginTab?.classList.remove("fn__none");
};

/** @导出说明: 插件动态注册 Dock 后立即渲染 */
/** 作用: 当插件在 onload 后调用 addDock() 时渲染 dock 按钮; 意图: 保证 dock 即时出现; 调用时机: addDock 末尾 */
/** @同步豁免: UI构建 */
export const addPluginDock = (plugin: Plugin) => {
    // 移动端走侧栏入口图标分支，桌面端走 dock 栏
    if (isMobile()) {
        showMobileSidebarPluginTab(plugin);
        return;
    }
    if (isWindow() || !getSiyuanLayout().leftDock) {
        return;
    }
    const dockKeys = Object.keys(plugin.docks);
    for (const dockKey of dockKeys) {
        if (document.querySelector(`.dock .dock__item[data-type="${dockKey}"]`)) {
            continue;
        }
        applyStoredDockConfig(plugin, dockKey);
        appendDockButton(dockKey, plugin);
    }
};
