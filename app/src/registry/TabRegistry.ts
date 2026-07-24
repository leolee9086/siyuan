/**
 * TabRegistry.ts - Tab 扩展点注册表
 * 
 * 解决问题：现有 Tab 注册分散在各插件的 models 中，
 * 内部功能需要创建伪造 Plugin 才能注册 Tab 类型。
 * 
 * 解决方案：提供全局 Tab 类型注册表，
 * 内部功能可直接注册，插件 API 委托给此注册表。
 */

/** 用途：注册表状态键；使用范围：Tab 类型注册、查询与注销；解耦评估：经 tab 领域网关连接稳定状态 API。 */
import {SForgeSymbols} from "./tab/imports";
/** 用途：注册表状态读取；使用范围：Tab 类型注册、查询与注销；解耦评估：经 tab 领域网关连接稳定状态 API。 */
import {getSForgeState} from "./tab/imports";
/** 用途：注册表状态写入；使用范围：首次初始化注册 Map；解耦评估：经 tab 领域网关连接稳定状态 API。 */
import {setSForgeState} from "./tab/imports";
/** 用途：Tab 注册信息；使用范围：注册表 Map 值；解耦评估：纯领域契约。 */
import type { TabRegistration } from "./TabRegistry.types";
/** 用途：宿主模型创建请求；使用范围：createModel 泛型入口；解耦评估：参数化应用和页签身份。 */
import type {TabModelCreateRequest} from "./TabRegistry.types";
/** 用途：宿主模型工厂协议；使用范围：将创建委托给布局组合层；解耦评估：具体 Custom class 不进入注册表。 */
import type {TabModelFactory} from "./TabRegistry.types";
/** 用途：注册模型领域身份；使用范围：约束工厂结果；解耦评估：纯结构契约，不依赖 Custom。 */
import type {ICustomTabModel} from "./TabRegistry.types";
/** 用途：注册表状态守卫；使用范围：读取全局状态时验证 Map；解耦评估：同领域输入校验。 */
import { isTabRegistryMap } from "./TabRegistry.guard";

// 重新导出类型
export type { TabRegistration } from "./TabRegistry.types";

/**
 * 获取注册表存储（模块级辅助函数）
 * 
 * 作用：获取或初始化全局 Tab 类型注册表
 * 意图：使用 SForge 全局状态存储，避免模块级变量问题
 */
function 获取注册表Map() {
    const existing = getSForgeState(SForgeSymbols.TAB_TYPE_REGISTRY);

    if (isTabRegistryMap(existing)) {
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
 * @同步豁免: 生命周期 - 类型注册必须在布局恢复或打开页签前同步完成。
 */
export function 注册Tab类型(registration: TabRegistration) {
    const 注册表 = 获取注册表Map();

    // 同一类型只允许一个所有者，避免后注册模块静默覆盖现有生命周期。
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
 * @同步豁免: 生命周期 - 布局创建模型时必须同步读取当前注册信息。
 */
export function 获取Tab注册信息(type: string) {
    return 获取注册表Map().get(type);
}

/**
 * 检查类型是否已注册
 * @param type 类型标识
 * @同步豁免: 生命周期 - 布局分派在同一调用栈中决定是否创建注册模型。
 */
export function Tab类型已注册(type: string) {
    return 获取注册表Map().has(type);
}

/**
 * 注销 Tab 类型
 * @param type 类型标识
 * @同步豁免: 生命周期 - 插件卸载必须立即移除其创建入口。
 */
export function 注销Tab类型(type: string) {
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
 * @同步豁免: UI构建 - Tab 模型必须在当前布局装配调用栈中创建并返回。
 */
export function 创建TabModel<TApplication, TTab, TData, TModel extends ICustomTabModel>(
    options: TabModelCreateRequest<TApplication, TTab, TData>,
    factory: TabModelFactory<TApplication, TTab, TData, TModel>,
) {
    const registration = 获取Tab注册信息(options.type);
    if (!registration) {
        return null;
    }

    return factory({...options, registration});
}

/**
 * 获取所有已注册类型（用于调试）
 * @柯里化 注册表对象需要保留稳定的无参查询命令，不能向调用方暴露内部 Map。
 * @同步豁免: 生命周期 - 调试和注册状态检查读取同一时刻的 Map 快照。
 */
// @柯里化 注册表对象需要保留稳定的无参查询命令，不能向调用方暴露内部 Map。
export const 获取所有Tab类型 = () => Array.from(获取注册表Map().keys());

/* @允许模块级变量: tabRegistry 是已经发布给内部功能和插件 API 的稳定函数表，并不保存注册数据、DOM、
 * 计时器或 class 实例；真实可变 Map 始终由 SForge 全局状态持有并通过获取注册表Map 读取。对象在创建后立即
 * 冻结，属性只引用无捕获的模块函数，HMR 不会形成第二份业务状态，测试也可以通过 SForge 状态重置隔离注册
 * 数据。保留该对象是为了兼容既有 tabRegistry.register/get/createModel 调用协议，改成每次创建新对象只会
 * 改变引用身份而没有生命周期收益，也会破坏插件持有的稳定对象引用。 */
export const tabRegistry = Object.freeze({
    register: 注册Tab类型,
    get: 获取Tab注册信息,
    has: Tab类型已注册,
    unregister: 注销Tab类型,
    createModel: 创建TabModel,
    getAllTypes: 获取所有Tab类型,
});

// 英文别名导出
/** 注册 Tab 类型的英文兼容入口。@同步豁免: 生命周期 - 注册必须同步生效。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const registerTabType = (registration: TabRegistration) => 注册Tab类型(registration);
/** 查询 Tab 注册信息的英文兼容入口。@同步豁免: 生命周期 - 查询服务于同步布局分派。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const getTabRegistration = (type: string) => 获取Tab注册信息(type);
/** 判断 Tab 类型的英文兼容入口。@同步豁免: 生命周期 - 判断服务于同步布局分派。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const hasTabType = (type: string) => Tab类型已注册(type);
/** 注销 Tab 类型的英文兼容入口。@同步豁免: 生命周期 - 注销必须同步生效。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const unregisterTabType = (type: string) => 注销Tab类型(type);
/** 创建 Tab 模型的英文兼容入口。@同步豁免: UI构建 - 模型必须同步返回。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const createTabModel = <TApplication, TTab, TData, TModel extends ICustomTabModel>(
    options: TabModelCreateRequest<TApplication, TTab, TData>,
    factory: TabModelFactory<TApplication, TTab, TData, TModel>,
) => 创建TabModel(options, factory);
/** 枚举 Tab 类型的英文兼容入口。@同步豁免: 生命周期 - 返回当前 Map 快照。@柯里化 保留既有英文 API。 */
// @柯里化 保留既有英文 API。
export const getAllTabTypes = () => 获取所有Tab类型();
