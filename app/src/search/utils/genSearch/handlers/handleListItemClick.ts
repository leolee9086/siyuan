/**
 * @fileoverview 列表项点击处理
 */

/** 用途：拼接 Electron 资源绝对路径；使用范围：资源双击打开系统目录；解耦评估：经同级网关直达标准路径实现。 */
import {originalPath} from "./imports";
/** 用途：读取双击阈值、搜索存储键；使用范围：列表交互；解耦评估：经同级网关直达稳定协议常量。 */
import {Constants} from "./imports";
/** 用途：排除带 Ctrl/Meta 的双击；使用范围：列表双击打开；解耦评估：复用统一热键判定，避免本地复制平台规则。 */
import {isNotCtrl} from "./imports";
/** 用途：识别 iPad 的不可靠 click detail；使用范围：浏览器单/双击判定；解耦评估：平台事实读取为无状态叶子能力。 */
import {isIPad} from "./imports";
/** 用途：调用系统文件管理器；使用范围：Electron 资源双击；解耦评估：明确的平台边界只消费命令和路径。 */
import {useShell} from "./imports";
/** 用途：渲染资源预览与轮转标记；使用范围：资源搜索结果点击；解耦评估：直达 Search Assets 唯一实现，不复制渲染逻辑。 */
import {renderPreview} from "./imports";
/** 用途：轮转资源预览标记；使用范围：重复资源点击；解耦评估：经同级网关直达 Search Assets 唯一实现。 */
import {renderNextAssetMark} from "./imports";
/** 用途：打开文档搜索结果；使用范围：Alt 点击和双击；解耦评估：直达 Search Editor 子域唯一导航实现。 */
import {openSearchEditor} from "./imports";
/** 用途：轮转文档搜索标记；使用范围：重复点击已聚焦结果；解耦评估：直达 Search Result 子域唯一实现。 */
import {renderNextSearchMark} from "./imports";
/** 用途：加载文档或无效引用预览；使用范围：首次聚焦结果；解耦评估：直达 Search Article 子域唯一实现。 */
import {getArticle} from "./imports";
/** 用途：严格识别资源搜索输入框；使用范围：资源预览查询；解耦评估：同一 Search 组合域守卫避免 DOM 断言。 */
import {isHTMLInputElement} from "./imports";
/** 用途：选择浏览器 iPad 和 Electron 行为；使用范围：列表点击与资源双击；解耦评估：只读取平台事实，不加载宿主实现。 */
import {isBrowser} from "./imports";
/** 用途：选择 Electron 资源双击行为；使用范围：资源系统目录；解耦评估：经同级网关直达平台事实。 */
import {isElectron} from "./imports";
/** 用途：约束列表点击完整共享上下文；使用范围：本文件全部交互函数；解耦评估：纯类型直达已有完整泛型契约。 */
import type {IListItemClickContext} from "./imports";
/** 用途：绑定列表点击上下文的应用身份；使用范围：搜索结果交互实现；解耦评估：具体 class 不进入共享状态契约。 */
import type {AppFacade} from "./imports";
/** 用途：绑定列表点击上下文的编辑器身份；使用范围：搜索结果交互实现；解耦评估：具体 class 不进入共享状态契约。 */
import type {ProtyleDomain} from "./imports";

/** 处理搜索列表中的新建文档项并保持点击计时状态。 */
const handleNewSearchItem = (ctx: IListItemClickContext<AppFacade, ProtyleDomain>) => {
    // 只有 SQL 搜索提供“按当前查询新建文档”语义。
    if (ctx.config.method === 0) {
        void ctx.app.createDocument(ctx.searchInputElement.value);
    }
    return {clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime};
};

/** 查询 Search 交互必须存在的 DOM 节点。 */
const getRequiredSearchElement = (root: ParentNode, selector: string) => {
    const element = root.querySelector(selector);
    if (!element) {
        throw new TypeError(`Search element is missing: ${selector}`);
    }
    return element;
};

/** 读取已初始化的资源搜索选项。 */
const getRequiredSearchAssetOptions = () => {
    const storage = window.siyuan.storage;
    if (!storage) {
        throw new TypeError("Search asset storage is unavailable");
    }
    const assetOptions = storage[Constants.LOCAL_SEARCHASSET];
    if (!assetOptions) {
        throw new TypeError("Search asset options are unavailable");
    }
    return assetOptions;
};

/**
 * 处理列表项点击
 * @同步豁免: UI构建 - 调用方立即保存返回的 clickTimeout/lastClickTime，改为异步会破坏后续双击取消与 iPad 时间判定。
 */
export function handleListItemClick(
    target: HTMLElement,
    event: MouseEvent,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>
) {
    const type = target.getAttribute("data-type");
    const { clickTimeout, lastClickTime } = ctx;

    // 新建文件
    if (type === "search-new") {
        return handleNewSearchItem(ctx);
    }

    // 搜索项点击
    if (type === "search-item") {
        return processSearchItemClick(target, event, ctx);
    }

    // 切换子项展开/折叠
    if (target.querySelector(".b3-list-item__toggle")) {
        target.nextElementSibling?.classList.toggle("fn__none");
        target.firstElementChild?.firstElementChild?.classList.toggle("b3-list-item__arrow--open");
    }

    return { clickTimeout, lastClickTime };
}

/**
 * 处理搜索项点击
 */
function processSearchItemClick(
    target: HTMLElement,
    event: MouseEvent,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>,
) {
    const element = ctx.element.querySelector("#searchAssetInput");
    const searchAssetInputElement = isHTMLInputElement(element) ? element : null;
    const searchType = target.dataset.id ? "asset" : (ctx.unRefPanelElement.classList.contains("fn__none") ? "doc" : "unRef");
    let {clickTimeout, lastClickTime} = ctx;

    let isClick = event.detail === 1;
    let isDblClick = event.detail === 2;

    // 浏览器环境下 iPad 的 detail 不可靠，需用时间差判断单双击
    if (isBrowser && isIPad()) {
        const newDate = Date.now();
        isClick = newDate - lastClickTime > Constants.TIMEOUT_DBLCLICK;
        isDblClick = !isClick;
        lastClickTime = newDate;
    }

    if (isClick) {
        const altKey = event.altKey;
        // 固定延迟用于区分同一列表项的单击与双击，时长沿用统一双击阈值。
        clickTimeout = window.setTimeout(() => {
            handleSingleClick(target, ctx, {searchType, searchAssetInputElement, altKey});
        }, Constants.TIMEOUT_DBLCLICK);
    }

    // 非修饰键双击取消待执行的单击，并立即执行打开动作。
    if (isDblClick && isNotCtrl(event)) {
        clearTimeout(clickTimeout);
        handleDoubleClick(target, searchType, ctx);
    }

    window.siyuan.menus?.menu?.remove();
    return { clickTimeout, lastClickTime };
}

/**
 * 处理单击
 */
function handleSingleClick(
    target: HTMLElement,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>,
    details: {
        searchType: string;
        searchAssetInputElement: HTMLInputElement | null;
        altKey: boolean;
    },
) {
    // 资源结果使用资源预览与标记轮转，不进入文档预览流程。
    if (details.searchType === "asset") {
        processAssetClick(target, ctx, details.searchAssetInputElement);
        return;
    }

    processDocOrUnRefClick(target, ctx, {searchType: details.searchType, altKey: details.altKey});
}

/**
 * 处理资源点击
 */
function processAssetClick(
    target: HTMLElement,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>,
    searchAssetInputElement: HTMLInputElement | null
) {
    // 首次点击聚焦资源并渲染预览，再次点击才轮转预览中的标记。
    if (!target.classList.contains("b3-list-item--focus")) {
        const focusedElement = ctx.element.querySelector("#searchAssets .b3-list-item--focus");
        focusedElement?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
        const assetOptions = getRequiredSearchAssetOptions();
        renderPreview(
            getRequiredSearchElement(ctx.element, "#searchAssetPreview"),
            target.dataset.id || "",
            searchAssetInputElement?.value || "",
            assetOptions.method,
        );
        searchAssetInputElement?.focus();
        return;
    }

    renderNextAssetMark(getRequiredSearchElement(ctx.element, "#searchAssetPreview"));
    searchAssetInputElement?.focus();
}

/**
 * 处理文档或无效引用点击
 */
function processDocOrUnRefClick(
    target: HTMLElement,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>,
    details: {searchType: string; altKey: boolean},
) {
    if (details.altKey) {
        openSearchEditor({
            rootId: target.getAttribute("data-root-id") || "",
            protyle: ctx.edit.protyle,
            id: target.getAttribute("data-node-id") || "",
            cb: ctx.closeCB,
            openPosition: "right",
        });
        return;
    }

    // 未聚焦的文档或无效引用先切换预览；已聚焦文档才进入标记轮转。
    if (!target.classList.contains("b3-list-item--focus")) {
        const panelElement = details.searchType === "doc" ? ctx.searchPanelElement : ctx.unRefPanelElement;
        const focusedElement = panelElement.querySelector(".b3-list-item--focus");
        focusedElement?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
        getArticle({
            edit: details.searchType === "doc" ? ctx.edit : ctx.unRefEdit,
            id: target.getAttribute("data-node-id") || "",
            config: details.searchType === "doc" ? ctx.config : null,
            value: details.searchType === "doc" ? ctx.searchInputElement.value : null,
        });
        ctx.searchInputElement.focus();
        return;
    }

    // 已聚焦的文档结果再次点击时轮转正文搜索标记。
    if (details.searchType === "doc") {
        renderNextSearchMark({
            edit: ctx.edit,
            id: target.getAttribute("data-node-id") || "",
            target,
        });
        ctx.searchInputElement.focus();
    }
}

/**
 * 处理双击
 */
function handleDoubleClick(
    target: HTMLElement,
    searchType: string,
    ctx: IListItemClickContext<AppFacade, ProtyleDomain>
) {
    // Electron 资源双击继续交给系统文件管理器。
    if (searchType === "asset" && isElectron) {
        useShell("showItemInFolder", originalPath().join(
            window.siyuan.config.system.dataDir,
            target.lastElementChild?.getAttribute("aria-label") || ""
        ));
        return;
    }
    // 浏览器资源双击没有文档导航动作。
    if (searchType === "asset") {
        return;
    }

    openSearchEditor({
        rootId: target.getAttribute("data-root-id") || "",
        protyle: ctx.edit.protyle,
        id: target.getAttribute("data-node-id") || "",
        cb: ctx.closeCB
    });
}

/**
 * 处理列表项切换按钮点击
 * @同步豁免: 需要绝对同步的DOM访问 - 点击处理器必须在当前事件栈内同时切换内容可见性与箭头状态。
 */
export function handleListToggleClick(target: HTMLElement) {
    target.parentElement?.nextElementSibling?.classList.toggle("fn__none");
    target.firstElementChild?.classList.toggle("b3-list-item__arrow--open");
}
