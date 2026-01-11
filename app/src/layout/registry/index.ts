/**
 * layout/registry/index.ts - 布局扩展点注册表统一导出
 */

// Tab 注册表
export {
    tabRegistry,
    注册Tab类型,
    获取Tab注册信息,
    Tab类型已注册,
    注销Tab类型,
    创建TabModel,
    获取所有Tab类型,
    registerTabType,
    getTabRegistration,
    hasTabType,
    unregisterTabType,
    createTabModel,
    getAllTabTypes,
} from "./TabRegistry";
export type { TabRegistration } from "./TabRegistry.types";
