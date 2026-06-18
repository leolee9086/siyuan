/** 用途：应用实例类型。使用范围：dock.types 类型定义。解耦评估：通过 imports.ts 转发。 */
import type { App } from "./imports";
/** 用途：页签类型。使用范围：dock.types 类型定义。解耦评估：通过 imports.ts 转发。 */
import type { Tab } from "./imports";
/** 用途：Protyle 编辑器类型。使用范围：dock.types 类型定义。解耦评估：通过 imports.ts 转发。 */
import type { Protyle } from "./imports";
/** 用途：模型基类类型。使用范围：dock.types 类型定义。解耦评估：通过 imports.ts 转发。 */
import type { Model } from "./imports";

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
