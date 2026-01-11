/**
 * TabRegistry.ts - Tab 扩展点注册表
 * 
 * 解决问题：现有 Tab 注册分散在各插件的 models 中，
 * 内部功能需要创建伪造 Plugin 才能注册 Tab 类型。
 * 
 * 解决方案：提供全局 Tab 类型注册表，
 * 内部功能可直接注册，插件 API 委托给此注册表。
 */

import { App } from "../../index";
import { SForgeSymbols, getSForgeState, setSForgeState } from "../../config/sforge";
import { Custom } from "../dock/Custom";
import { Tab } from "../Tab";
import { clearOBG } from "../dock/util";
import { setPanelFocus } from "../utils/setPanelFocus";
import type { TabRegistration } from "./TabRegistry.types";

// 重新导出类型
export type { TabRegistration } from "./TabRegistry.types";

/**
 * 获取注册表存储（模块级辅助函数）
 * 
 * 作用：获取或初始化全局 Tab 类型注册表
 * 意图：使用 SForge 全局状态存储，避免模块级变量问题
 */
function 获取注册表Map(): Map<string, TabRegistration> {
    const existing = getSForgeState(SForgeSymbols.TAB_TYPE_REGISTRY);

    if (existing instanceof Map) {
        return existing;
    }

    const newRegistry = new Map<string, TabRegistration>();
    setSForgeState(SForgeSymbols.TAB_TYPE_REGISTRY, newRegistry);
    return newRegistry;
}

/**
 * 注册 Tab 类型
 * 
 * 作用：将 Tab 类型配置注册到全局注册表
 * 意图：支持内部功能和插件统一注册 Tab
 * 调用时机：应用初始化时或插件加载时
 * 
 * @param registration Tab 注册配置
 * @returns 是否注册成功
 */
export function 注册Tab类型(registration: TabRegistration): boolean {
    const 注册表 = 获取注册表Map();

    if (注册表.has(registration.type)) {
        console.warn(`[TabRegistry] 类型已存在: ${registration.type}`);
        return false;
    }

    注册表.set(registration.type, registration);
    return true;
}

/**
 * 获取 Tab 注册信息
 * 
 * 作用：根据类型获取注册配置
 * @param type 类型标识
 */
export function 获取Tab注册信息(type: string): TabRegistration | undefined {
    return 获取注册表Map().get(type);
}

/**
 * 检查类型是否已注册
 * @param type 类型标识
 */
export function Tab类型已注册(type: string): boolean {
    return 获取注册表Map().has(type);
}

/**
 * 注销 Tab 类型
 * @param type 类型标识
 */
export function 注销Tab类型(type: string): boolean {
    return 获取注册表Map().delete(type);
}

/**
 * 创建 Custom Model 实例
 * 
 * 作用：根据注册信息创建 Tab 的 Custom Model
 * 意图：统一 Tab 创建逻辑，自动添加聚焦监听
 * 调用时机：打开新 Tab 时或恢复布局时
 * 
 * @param options 创建选项
 * @returns Custom 实例，若类型未注册则返回 null
 */
export function 创建TabModel(options: {
    app: App;
    tab: Tab;
    type: string;
    data: unknown;
}): Custom | null {
    const registration = 获取Tab注册信息(options.type);
    if (!registration) {
        return null;
    }

    const customObj = new Custom({
        app: options.app,
        tab: options.tab,
        type: options.type,
        data: options.data,
        init: registration.init,
        // 只传递定义了的回调，避免 undefined 传递问题
        ...(registration.destroy ? { destroy: registration.destroy } : {}),
        ...(registration.beforeDestroy ? { beforeDestroy: registration.beforeDestroy } : {}),
        ...(registration.resize ? { resize: registration.resize } : {}),
        ...(registration.update ? { update: registration.update } : {}),
    });

    // 添加点击聚焦监听（与 Plugin.addTab 一致）
    const parentElement = customObj.element.parentElement?.parentElement;
    if (parentElement) {
        customObj.element.addEventListener("click", () => {
            clearOBG();
            setPanelFocus(parentElement);
        });
    }

    return customObj;
}

/**
 * 获取所有已注册类型（用于调试）
 */
export function 获取所有Tab类型(): string[] {
    return Array.from(获取注册表Map().keys());
}

// 提供兼容对象形式的 API（供旧代码使用）
export const tabRegistry = {
    register: 注册Tab类型,
    get: 获取Tab注册信息,
    has: Tab类型已注册,
    unregister: 注销Tab类型,
    createModel: 创建TabModel,
    getAllTypes: 获取所有Tab类型,
};

// 英文别名导出
export const registerTabType = 注册Tab类型;
export const getTabRegistration = 获取Tab注册信息;
export const hasTabType = Tab类型已注册;
export const unregisterTabType = 注销Tab类型;
export const createTabModel = 创建TabModel;
export const getAllTabTypes = 获取所有Tab类型;
