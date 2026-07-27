/** 用途：完整 Protyle 领域根；使用范围：文章预览操作上下文；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "./imports";

/** 搜索结果文章预览一次加载所需的完整上下文。 */
export type ArticlePreviewOptions = {
    id: string;
    config?: Config.IUILayoutTabSearchConfig;
    edit: ProtyleDomain;
    value?: string;
};

/** 内核正文响应应用阶段的完整上下文。 */
export type ArticleResponseContext = {
    options: ArticlePreviewOptions;
    zoomIn: boolean;
    response: IWebSocketData;
    docInfoResponse: IWebSocketData;
};

/** 一次 CSS Highlight 渲染持有的局部观察器状态。 */
export type HighlightObserverContext = {
    options: ArticlePreviewOptions;
    contentRect: DOMRect;
    observer?: ResizeObserver;
};
