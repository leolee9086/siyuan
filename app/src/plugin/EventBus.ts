/**
 * @导入用途: 菜单项构建类，用于创建菜单项和分隔符
 * @使用范围: emitOpenMenu函数中构建插件子菜单的菜单项
 * @解耦评估: 核心UI组件，菜单系统必须依赖，无法解耦
 */
import { MenuItem } from "./imports";

/**
 * @导入用途: 子菜单容器类，用于收集插件注册的菜单项
 * @使用范围: emitOpenMenu函数中作为插件菜单项的容器
 * @解耦评估: 核心UI组件，菜单系统必须依赖，无法解耦
 */
import { subMenu } from "./imports";

/**
 * @导入用途: 获取全局菜单实例，用于向全局菜单添加内容
 * @使用范围: emitOpenMenu函数中向全局菜单追加插件子菜单
 * @解耦评估: 可通过依赖注入解耦，但当前全局访问更简洁
 */
import { getSiyuanGlobalMenus } from "./imports";

/**
 * @导入用途: 获取国际化文本，用于显示多语言标签
 * @使用范围: emitOpenMenu函数中显示"插件"菜单标签
 * @解耦评估: 可通过参数传递解耦，但当前全局访问更符合国际化模式
 */
import { siyuanI18n } from "./imports";

/**
 * @导入用途: Plugin类型定义，用于插件实例的类型标注
 * @使用范围: emitOpenMenu函数的参数类型定义
 * @解耦评估: 核心类型依赖，插件事件系统必须依赖插件类型，无法解耦
 */
import type { Plugin } from "./index";

/**
 * 事件总线类，提供基于DOM的发布订阅机制
 * 
 * 用于插件系统和应用内部的事件通信，支持类型安全的事件监听和触发
 */
export class EventBus<DetailType = unknown> {
    private eventTarget: EventTarget;

    /**
     * 构造事件总线实例
     *
     * 作用：创建一个事件目标节点用于事件监听和触发
     * 意图：提供轻量级的事件通信机制，避免直接耦合
     * 调用时机：插件初始化时或需要独立事件通道时
     *
     * @同步豁免: 生命周期 - 构造函数必须是同步的
     */
    constructor(name: string | Document = "") {
        // 当传入document时，直接使用document作为事件目标，用于全局事件
        if (name === document) {
            this.eventTarget = document;
            return;
        }
        // 否则创建一个注释节点作为事件目标，避免污染DOM结构
        this.eventTarget = document.appendChild(document.createComment(typeof name === "string" ? name : ""));
    }

    /**
     * 注册事件监听器
     *
     * 作用：监听指定类型的事件
     * 意图：允许订阅者响应事件
     * 调用时机：需要监听某个事件时
     *
     * @同步豁免: 生命周期 - addEventListener是同步API
     */
    on(type: TEventBus, listener: EventListener) {
        this.eventTarget.addEventListener(type, listener);
    }

    /**
     * 注册一次性事件监听器
     *
     * 作用：监听指定类型的事件，触发一次后自动移除
     * 意图：避免手动管理监听器生命周期
     * 调用时机：只需要响应一次事件时
     *
     * @同步豁免: 生命周期 - addEventListener是同步API
     */
    once(type: TEventBus, listener: EventListener) {
        this.eventTarget.addEventListener(type, listener, { once: true });
    }

    /**
     * 移除事件监听器
     *
     * 作用：取消对指定事件的监听
     * 意图：避免内存泄漏和不必要的事件处理
     * 调用时机：不再需要监听事件时（如组件销毁）
     *
     * @同步豁免: 生命周期 - removeEventListener是同步API
     */
    off(type: TEventBus, listener: EventListener) {
        this.eventTarget.removeEventListener(type, listener);
    }

    /**
     * 触发事件
     * 
     * 作用：向所有监听器广播事件
     * 意图：通知订阅者某个事件发生
     * 调用时机：需要通知其他模块某个状态变化或操作发生时
     * 
     * @同步豁免: 生命周期 - dispatchEvent是同步API
     */
    emit(type: TEventBus, detail?: DetailType) {
        return this.eventTarget.dispatchEvent(new CustomEvent(type, { detail, cancelable: true }));
    }
}

/**
 * 触发插件菜单打开事件并构建插件子菜单
 * 
 * 作用：向所有插件广播菜单打开事件，收集插件注册的菜单项，并将其添加到全局菜单中
 * 意图：为插件提供统一的菜单扩展机制，允许插件在各种上下文菜单中注入自定义菜单项
 * 调用时机：在需要显示可扩展菜单时调用（如编辑器右键菜单、块图标菜单等）
 * 
 * @同步豁免: UI构建 - 菜单构建是同步的DOM操作，必须立即完成以保证用户交互响应
 */
export const emitOpenMenu = (options: {
    plugins: Plugin[],
    type: TEventBus,
    detail: { menu?: subMenu } & Record<string, unknown>,
    separatorPosition?: "top" | "bottom",
}) => {
    const pluginSubMenu = new subMenu();
    options.detail.menu = pluginSubMenu;
    
    // 遍历所有插件，触发事件让插件注册菜单项
    for (const plugin of options.plugins) {
        plugin.eventBus.emit(options.type, options.detail);
    }
    
    // 当插件注册了菜单项且需要顶部分隔符时添加
    if (pluginSubMenu.menus.length > 0 && options.separatorPosition === "top") {
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_pluginTop", type: "separator" }).element);
    }
    
    // 当插件注册了菜单项时添加插件子菜单
    if (pluginSubMenu.menus.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "plugin",
            label: siyuanI18n.plugin,
            icon: "iconPlugin",
            type: "submenu",
            submenu: pluginSubMenu.menus,
        }).element);
    }
    
    // 当插件注册了菜单项且需要底部分隔符时添加
    if (pluginSubMenu.menus.length > 0 && options.separatorPosition === "bottom") {
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_pluginBottom", type: "separator" }).element);
    }
};
