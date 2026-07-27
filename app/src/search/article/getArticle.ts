/** 用途：折叠状态决定预览加载模式；使用范围：搜索结果文章预览；解耦评估：预览加载必须在请求前同步取得 zoom 状态。 */
import {checkFold} from "./imports";
/** 用途：搜索预览请求常量；使用范围：文档加载动作和观察器超时；解耦评估：稳定静态值。 */
import {Constants} from "./imports";
/** 用途：请求文档信息与正文；使用范围：搜索结果文章预览；解耦评估：统一网络传输实现。 */
import {fetchPost} from "./imports";
/** 用途：显示预览加载态；使用范围：文章切换开始时；解耦评估：既有 Protyle UI 操作。 */
import {addLoading} from "./imports";
/** 用途：应用内核文档响应；使用范围：文章正文返回后；解耦评估：Protyle 统一响应入口。 */
import {onGet} from "./imports";
/** 用途：渲染并定位搜索高亮；使用范围：正文装载完成后；解耦评估：既有 Protyle 搜索渲染能力。 */
import {isSupportCSSHL} from "./imports";
/** 用途：渲染搜索高亮范围；使用范围：正文装载后的 CSS Highlight 路径；解耦评估：经本域网关直达唯一渲染实现。 */
import {searchMarkRender} from "./imports";
/** 用途：CSS Highlight 无文本范围时定位块；使用范围：预览高亮完成后；解耦评估：共享 DOM 定位操作。 */
import {highlightById} from "./imports";
/** 用途：将当前搜索范围滚动到预览中心；使用范围：预览高亮完成后；解耦评估：Search 纯滚动实现。 */
import {scrollToCurrent} from "./imports";
/** 用途：识别加密笔记本并补充请求参数；使用范围：文档信息与正文请求；解耦评估：统一路径领域判断。 */
import {isEncryptedBox} from "./imports";
/** 用途：创建文章高亮尺寸观察器；使用范围：CSS Highlight 生命周期；解耦评估：复用共享 DOM 观察器工厂，避免重复构造实现。 */
import {createResizeObserver} from "./imports";
/** 用途：读取已初始化的编辑器配置；使用范围：正文请求大小；解耦评估：经本域网关直达严格环境访问器。 */
import {getSiyuanConfig} from "./imports";
/** 用途：可扩展内核请求结构；使用范围：文章请求参数；解耦评估：网络层公开类型。 */
import type {IFetchRequestObject} from "./imports";
/** 用途：文章预览完整操作及内部阶段上下文；使用范围：本模块请求与渲染流程；解耦评估：纯类型不加载运行时实现。 */
import type {ArticlePreviewOptions} from "./getArticle.types";
/** 用途：正文响应阶段完整上下文；使用范围：响应应用函数；解耦评估：同领域纯类型。 */
import type {ArticleResponseContext} from "./getArticle.types";
/** 用途：单次高亮观察器上下文；使用范围：CSS Highlight 生命周期；解耦评估：同领域纯类型。 */
import type {HighlightObserverContext} from "./getArticle.types";
/** 用途：登记并校验当前文章预览；使用范围：文章异步请求过期隔离；解耦评估：直达本领域唯一状态注册表。 */
import {isCurrentArticlePreview} from "./articlePreview.registry";
/** 用途：登记当前文章预览；使用范围：预览请求启动前；解耦评估：直达本领域唯一状态注册表。 */
import {selectArticlePreview} from "./articlePreview.registry";

/** 读取文章预览必需的笔记本标识。 */
const getRequiredNotebookId = (protyle: IProtyle) => {
    if (!protyle.notebookId) {
        throw new TypeError("Article preview Protyle is missing notebookId");
    }
    return protyle.notebookId;
};

/** 读取文章预览必需的正文容器。 */
const getRequiredContentElement = (protyle: IProtyle) => {
    if (!protyle.contentElement) {
        throw new TypeError("Article preview Protyle is missing contentElement");
    }
    return protyle.contentElement;
};

/** 读取文章预览必需的 WYSIWYG 根节点。 */
const getRequiredWysiwygElement = (protyle: IProtyle) => {
    if (!protyle.wysiwyg) {
        throw new TypeError("Article preview Protyle is missing wysiwyg");
    }
    return protyle.wysiwyg.element;
};

/** 读取文章预览必需的滚动状态。 */
const getRequiredScroll = (protyle: IProtyle) => {
    if (!protyle.scroll) {
        throw new TypeError("Article preview Protyle is missing scroll");
    }
    return protyle.scroll;
};

/** 加密笔记本请求必须携带 notebook 标识。 */
const addEncryptedNotebook = (params: IFetchRequestObject, notebookId: string) => {
    // 加密笔记本的内核接口需要 notebook 参数才能解密并读取目标文档。
    if (isEncryptedBox(notebookId)) {
        params.notebook = notebookId;
    }
};

/** 将 CSS Highlight 的当前范围定位到预览中心。 */
const highlightCurrentRange = (options: ArticlePreviewOptions, contentRect: DOMRect) => {
    const ranges = options.edit.protyle.highlight.ranges;
    const currentRange = ranges[options.edit.protyle.highlight.rangeIndex];
    // 空范围和折叠后的空文本范围都回到块级定位。
    if (ranges.length === 0 || !currentRange || !currentRange.toString()) {
        highlightById(options.edit.protyle, options.id, "center");
        return;
    }
    scrollToCurrent(getRequiredContentElement(options.edit.protyle), currentRange, contentRect);
};

/** 高亮 DOM 就绪后开始定位，并在预览尺寸变化时重新定位。 */
const handleHighlightsRendered = (context: HighlightObserverContext) => {
    if (context.observer) {
        context.observer.disconnect();
    }
    highlightCurrentRange(context.options, context.contentRect);
    context.observer = createResizeObserver(() => {
        highlightCurrentRange(context.options, context.contentRect);
    });
    context.observer.observe(getRequiredWysiwygElement(context.options.edit.protyle));
    // ResizeObserver 没有高亮完成事件，沿用统一预览生命周期常量限时清理以避免持续持有编辑器。
    setTimeout(() => {
        context.observer?.disconnect();
    }, Constants.TIMEOUT_COUNT);
};

/** 监听预览尺寸变化并保持 CSS Highlight 定位。 */
const renderCSSHighlights = (options: ArticlePreviewOptions, keywords: string[], contentRect: DOMRect) => {
    const context: HighlightObserverContext = {options, contentRect};
    searchMarkRender(options.edit.protyle, keywords, options.id, () => handleHighlightsRendered(context));
};

/** 在不支持 CSS Highlight 时使用既有搜索标记定位。 */
const renderLegacyHighlight = (options: ArticlePreviewOptions, contentRect: DOMRect) => {
    const wysiwygElement = getRequiredWysiwygElement(options.edit.protyle);
    const matchElements = wysiwygElement.querySelectorAll('span[data-type~="search-mark"]');
    if (matchElements.length === 0) {
        return;
    }
    const firstMatch = matchElements.item(0);
    if (!firstMatch) {
        throw new TypeError("Article preview search mark is missing");
    }
    firstMatch.classList.add("search-mark--hl");
    const contentElement = getRequiredContentElement(options.edit.protyle);
    contentElement.scrollTop = contentElement.scrollTop +
        firstMatch.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
};

/** 正文装载后按当前浏览器能力渲染搜索高亮。 */
const renderArticleHighlight = (options: ArticlePreviewOptions, keywords: string[]) => {
    const contentRect = getRequiredContentElement(options.edit.protyle).getBoundingClientRect();
    // 支持 CSS Highlight 时使用 Range 渲染，否则进入既有 DOM mark 路径。
    if (isSupportCSSHL()) {
        renderCSSHighlights(options, keywords, contentRect);
        return;
    }
    renderLegacyHighlight(options, contentRect);
};

/** 为启用标题渲染的文章预览应用文档信息标题。 */
const renderArticleTitle = (options: ArticlePreviewOptions, response: IWebSocketData) => {
    if (!options.edit.protyle.options.render?.title) {
        return;
    }
    const title = options.edit.protyle.title;
    if (!title) {
        throw new TypeError("Article preview Protyle is missing title");
    }
    title.render(options.edit.protyle, response);
};

/** 将文档响应应用到预览 Protyle，并保留标题刷新顺序。 */
const applyArticleResponse = ({options, zoomIn, response, docInfoResponse}: ArticleResponseContext) => {
    options.edit.protyle.query = {
        key: options.value || null,
        method: options.config?.method || null,
        types: options.config?.types || null,
        subTypes: options.config?.subTypes || null,
    };
    onGet({
        updateReadonly: true,
        data: response,
        protyle: options.edit.protyle,
        action: zoomIn ? [Constants.CB_GET_ALL, Constants.CB_GET_HTML] : [Constants.CB_GET_HTML],
        /** 正文进入 Protyle 后渲染搜索高亮，确保目标 DOM 已经存在。 */
        afterCB() {
            renderArticleHighlight(options, response.data.keywords);
        }
    });
    renderArticleTitle(options, docInfoResponse);
};

/** 在文档信息返回后请求并应用文章正文。 */
const fetchArticleDocument = (options: ArticlePreviewOptions, zoomIn: boolean, docInfoResponse: IWebSocketData) => {
    const params: IFetchRequestObject = {
        id: options.id,
        query: options.value || null,
        queryMethod: options.config?.method || null,
        queryTypes: options.config?.types || null,
        querySubTypes: options.config?.subTypes || null,
        mode: zoomIn ? 0 : 3,
        size: zoomIn ? Constants.SIZE_GET_MAX : getSiyuanConfig().editor.dynamicLoadBlocks,
        zoom: zoomIn,
        highlight: !isSupportCSSHL(),
    };
    addEncryptedNotebook(params, getRequiredNotebookId(options.edit.protyle));
    fetchPost("/api/filetree/getDoc", params, response => {
        if (!isCurrentArticlePreview(options.id)) {
            return;
        }
        applyArticleResponse({options, zoomIn, response, docInfoResponse});
    });
};

/** 折叠模式确定后请求文档信息，并阻止过期选择继续加载正文。 */
const loadArticle = (options: ArticlePreviewOptions, zoomIn: boolean) => {
    if (!isCurrentArticlePreview(options.id)) {
        return;
    }
    getRequiredScroll(options.edit.protyle).lastScrollTop = 0;
    addLoading(options.edit.protyle);
    const params: IFetchRequestObject = {id: options.id};
    addEncryptedNotebook(params, getRequiredNotebookId(options.edit.protyle));
    fetchPost("/api/block/getDocInfo", params, response => {
        if (!isCurrentArticlePreview(options.id)) {
            return;
        }
        fetchArticleDocument(options, zoomIn, response);
    });
};

/** 加载当前搜索结果对应的文章预览，并丢弃已过期文章请求的回调。 */
/** @同步豁免: 生命周期 - 必须在当前选择事件栈立即登记文章并启动既有回调链，Promise 会改变返回身份。 */
export const getArticle = (options: ArticlePreviewOptions) => {
    selectArticlePreview(options.id);
    checkFold(options.id, zoomIn => loadArticle(options, zoomIn));
};
