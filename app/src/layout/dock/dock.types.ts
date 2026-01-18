
import { App } from "../../index";
import { Tab } from "../Tab";
import { Protyle } from "../../protyle";
import { Model } from "../Model";

/**
 * Model 工厂函数类型
 * 
 * 用途：定义创建 Dock Model 的函数签名（函数式组件）
 * 使用场景：MODEL_FACTORIES 中的普通工厂函数
 */
export type ModelFactory = (app: App, tab: Tab, editor?: Protyle, data?: unknown) => Model | undefined;

/**
 * Model 构造函数类型
 * 
 * 用途：定义 Dock Model 的类构造函数签名（类式组件）
 * 使用场景：MODEL_FACTORIES 中的类构造器，如 Bookmark, Tag 等
 */
export type ModelConstructor = new (app: App, tab: Tab, editor?: Protyle, data?: unknown) => Model;
