/**
 * 布局反序列化类型定义
 */
import type { Tab } from "./Tab";

/** 存储需要移除的空Tab状态 */
export interface RemovedTabState {
    /** 待移除的Tab列表 */
    tabs: Tab[];
}

/** 布局容器联合类型 */
export type LayoutContainer = import("./index").Layout 
    | import("./Wnd").Wnd 
    | Tab 
    | import("./Model").Model;

/** 可选的布局容器类型 */
export type OptionalLayoutContainer = LayoutContainer | undefined;

/** 子布局类型（可以是 Layout、Wnd、Tab 或 Model） */
export type ChildLayout = import("./index").Layout 
    | import("./Wnd").Wnd 
    | Tab 
    | import("./Model").Model 
    | undefined;

/** Tab 头部元素初始化数据 */
export interface TabInitData {
    instance: string;
    customModelType?: string;
    [key: string]: unknown;
}

/** URL 文件打开参数 */
export interface IdZoomInResult {
    id: string;
    isZoomIn: boolean;
}

// ============ Model 处理器类型 ============

import type { App } from "../index";

/** Model 类型检查函数类型 */
export type ModelTypeChecker = (json: Config.TUILayoutItem) => boolean;

/** Model 处理器函数类型 */
export type ModelHandler = (app: App, json: Config.TUILayoutItem, layout: Tab) => void;

/** Model 处理器配置 */
export interface ModelHandlerConfig {
    check: ModelTypeChecker;
    handle: ModelHandler;
}
