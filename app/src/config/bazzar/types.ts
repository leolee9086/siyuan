/**
 * 用途：表示 Bazaar 面板共享的完整包与关键词状态。
 * 使用场景：运行时数据单例、面板协议和事件处理器共同读写该状态。
 * 关联类型：各包集合使用 IBazaarItem，键空间与 TBazaarType 的内建包类型保持一致。
 */
export interface IBazaarData {
    themes: IBazaarItem[];
    templates: IBazaarItem[];
    icons: IBazaarItem[];
    widgets: IBazaarItem[];
    plugins: IBazaarItem[];
    downloaded: IBazaarItem[];
    downloadedDefault: IBazaarItem[];
    update: {
        themes: IBazaarItem[];
        templates: IBazaarItem[];
        icons: IBazaarItem[];
        widgets: IBazaarItem[];
        plugins: IBazaarItem[];
    };
    keywords: {
        themes: string[];
        templates: string[];
        icons: string[];
        widgets: string[];
        plugins: string[];
    };
    selectedKeywords: {
        themes: string[];
        templates: string[];
        icons: string[];
        widgets: string[];
        plugins: string[];
    };
}

/**
 * 用途：表示 Bazaar 面板向事件与渲染模块提供的完整业务协议。
 * 使用场景：面板对象与拆分后的事件、安装和导航流程协作。
 * 关联类型：TApplication 由宿主实现绑定，数据状态由 IBazaarData 统一定义。
 */
export interface IBazaar<TApplication> {
    element: HTMLElement | undefined;
    _data: IBazaarData;
    _onBazaar(response: IWebSocketData, bazaarType: TBazaarType): void;
    _genMyHTML(bazaarType: TBazaarType, app: TApplication, updateUpdate?: boolean): void;
    _renderReadme(bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean): void;
    genHTML(): string;
    bindEvent(app: TApplication): void;
    _renderFilteredPackages(bazaarType: TBazaarType): void;
}

/**
 * 用途：表示 Bazaar 卡片序列化到 DOM 属性中的导航与安装数据。
 * 使用场景：点击、排序、详情和安装流程解析卡片的 data-obj 属性后使用。
 * 关联类型：bazaarType 选择 IBazaarData 中对应的包集合，其余字段来自后端包元数据。
 */
export interface IBazaarDataObj {
    bazaarType: TBazaarType;
    themeMode?: string;
    updated?: string;
    name?: string;
    repoURL?: string;
    repoHash?: string;
    downloaded?: boolean;
    downloads?: number;
    [key: string]: unknown;
}
