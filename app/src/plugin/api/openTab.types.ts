/**
 * 用途：应用主类类型，用于类型定义
 * 使用范围：openTab相关类型定义
 * 解耦评估：通过imports.ts转发
 */
import type { App } from "./imports";

/**
 * 用途：布局模型类型，用于类型定义
 * 使用范围：openTab相关类型定义
 * 解耦评估：通过imports.ts转发
 */
import type { Model } from "./imports";

/**
 * 用途：文档打开选项配置
 * 使用场景：通过openTab打开文档类型页签时使用
 * 关联类型：作为IOpenTabOptions.doc字段的类型
 */
export interface IOpenTabDocOptions {
    /** 文档ID */
    id: string;
    /** Protyle编辑器动作列表，用于控制文档加载后的行为 */
    action?: TProtyleAction[];
    /** 是否聚焦到文档内容（放大模式） */
    zoomIn?: boolean;
    /** 文档打开模式，默认 "wysiwyg" */
    mode?: TEditorMode;
}

/**
 * 用途：PDF文件打开选项配置
 * 使用场景：通过openTab打开PDF资源时使用
 * 关联类型：作为IOpenTabOptions.pdf字段的类型
 */
export interface IOpenTabPdfOptions {
    /** PDF文件路径 */
    path: string;
    /** 打开到指定页码 */
    page?: number;
    /** PDF文档ID（用于定位到特定注释） */
    id?: string;
}

/**
 * 用途：资源文件打开选项配置
 * 使用场景：通过openTab打开图片、音频、视频等资源文件时使用
 * 关联类型：作为IOpenTabOptions.asset字段的类型
 */
export interface IOpenTabAssetOptions {
    /** 资源文件路径 */
    path: string;
}

/**
 * 用途：闪卡页签打开选项配置
 * 使用场景：通过openTab打开间隔重复闪卡页签时使用
 * 关联类型：作为IOpenTabOptions.card字段的类型
 */
export interface IOpenTabCardOptions {
    /** 闪卡类型（复习、新卡等） */
    type: TCardType;
    /** 卡包ID */
    id?: string;
    /** 卡包标题 */
    title?: string;
}

/**
 * 用途：自定义页签打开选项配置
 * 使用场景：通过openTab打开插件自定义页签时使用
 * 关联类型：作为IOpenTabOptions.custom字段的类型
 */
export interface IOpenTabCustomOptions {
    /** 页签标题 */
    title: string;
    /** 页签图标 */
    icon: string;
    /** 自定义数据，传递给页签组件 */
    data?: unknown;
    /** 页签唯一标识 */
    id: string;
}

/**
 * 用途：打开页签的统一配置接口
 * 使用场景：调用openTab函数时使用，支持打开文档、PDF、资源、搜索、闪卡、自定义等多种页签类型
 * 关联类型：包含IOpenTabDocOptions、IOpenTabPdfOptions等子配置类型
 * 注意：doc/pdf/asset/search/card/custom字段互斥，只能指定其中一个
 */
export interface IOpenTabOptions {
    /** 应用实例，用于访问全局状态和布局管理器 */
    app: App;
    /** 文档打开配置 */
    doc?: IOpenTabDocOptions;
    /** PDF打开配置 */
    pdf?: IOpenTabPdfOptions;
    /** 资源文件打开配置 */
    asset?: IOpenTabAssetOptions;
    /** 搜索页签配置 */
    search?: Config.IUILayoutTabSearchConfig;
    /** 闪卡页签配置 */
    card?: IOpenTabCardOptions;
    /** 自定义页签配置 */
    custom?: IOpenTabCustomOptions;
    /** 页签打开位置（右侧或底部） */
    position?: "right" | "bottom";
    /** 是否保持光标位置 */
    keepCursor?: boolean;
    /** 是否移除当前页签 */
    removeCurrentTab?: boolean;
    /** 页签打开后的回调函数 */
    afterOpen?: (model?: Model) => void;
}
