/** 用途：布局模型最小接口。使用范围：Dock 工厂返回值。解耦评估：模型创建协议只依赖布局领域契约。 */
import type {ILayoutModel} from "../lifecycle/model.types";

/**
 * Model 工厂函数类型
 * 
 * 用途：定义创建 Dock Model 的函数签名（函数式组件）
 * 使用场景：MODEL_FACTORIES 中的普通工厂函数
 */
export type ModelFactory<TApplication, TTab, TEditor, TData> = (
    app: TApplication,
    tab: TTab,
    editor?: TEditor,
    data?: TData
) => ILayoutModel | undefined;

/**
 * Model 构造函数类型
 * 
 * 用途：定义 Dock Model 的类构造函数签名（类式组件）
 * 使用场景：MODEL_FACTORIES 中的类构造器，如 Bookmark, Tag 等
 */
export type ModelConstructor<TApplication, TTab, TEditor, TData> = new (
    app: TApplication,
    tab: TTab,
    editor?: TEditor,
    data?: TData
) => ILayoutModel;
