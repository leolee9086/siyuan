/**
 * 布局反序列化类型定义
 */
import type { Tab } from "./Tab";



/** 布局容器联合类型 */
export type LayoutContainer = import("./index").Layout 
    | import("./Wnd").Wnd 
    | Tab 
    | import("./Model").Model;


/** 子布局类型（可以是 Layout、Wnd、Tab 或 Model） */
export type ChildLayout = import("./index").Layout 
    | import("./Wnd").Wnd 
    | Tab 
    | import("./Model").Model 
    | undefined;



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

