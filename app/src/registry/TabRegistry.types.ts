/**
 * TabRegistry.types.ts - Tab 注册表类型定义
 */

/** 自定义页签初始化回调实际使用的模型结构，不依赖 Custom class。 */
export interface ICustomTabModel {
    element: Element;
    tab: {
        panelElement: HTMLElement;
    };
    data: unknown;
    type: string;
    editors: IProtyle[];
}

/**
 * Tab 注册信息
 */
export interface TabRegistration {
    /** 唯一类型标识 */
    type: string;
    /** 初始化函数 */
    init: (model: ICustomTabModel) => void;
    /** 销毁回调 */
    destroy?: () => void;
    /** 销毁前回调 */
    beforeDestroy?: () => void;
    /** 调整大小回调 */
    resize?: () => void;
    /** 更新回调 */
    update?: () => void;
}

/** TabRegistry 查询注册信息并请求宿主创建模型时使用的完整领域参数。 */
export interface TabModelCreateRequest<TApplication, TTab, TData> {
    app: TApplication;
    tab: TTab;
    type: string;
    data: TData;
}

/** 宿主模型工厂接收的完整上下文，在创建请求上附加已经解析的注册信息。 */
export interface TabModelFactoryContext<TApplication, TTab, TData> extends TabModelCreateRequest<TApplication, TTab, TData> {
    registration: TabRegistration;
}

/** TabRegistry 与宿主布局组合层之间的模型创建协议。 */
export type TabModelFactory<TApplication, TTab, TData, TModel extends ICustomTabModel> = (
    context: TabModelFactoryContext<TApplication, TTab, TData>
) => TModel;
