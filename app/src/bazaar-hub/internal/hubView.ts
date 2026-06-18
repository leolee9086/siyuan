/** 用途：复用 DOM 守卫。使用范围：hub 渲染和事件解析。解耦评估：基础工具依赖，通过内部网关导入降低路径耦合。 */
import { isHTMLElement } from "./imports";

/** 用途：包索引类型。使用范围：hub 状态约束。 */
import type { IBazaarPublishedIndex } from "./imports";

/** 用途：包项类型。使用范围：hub 列表过滤和卡片渲染。 */
import type { IBazaarPublishedItem } from "./imports";

/** 用途：工作空间聚合类型。使用范围：hub 状态约束。 */
import type { IBazaarWorkspaceBundle } from "./imports";

/** 用途：读取未知对象字符串字段。意图：避免类型断言。调用时机：解析 model.data 和事件 detail。问题/改进：仅处理字符串字段。 */
/** 导出 readStringField 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const readStringField = (data: unknown, key: string) => {
    if (!data || typeof data !== "object") {
        return "";
    }
    const rawValue = Reflect.get(data, key);
    if (typeof rawValue !== "string") {
        return "";
    }
    return rawValue.trim();
};

/** 用途：从点击事件读取 sourceID。意图：统一源动作参数提取。调用时机：点击源列表和包卡片按钮。问题/改进：依赖 data-source-id 属性。 */
/** 导出 readSourceIDFromEvent 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const readSourceIDFromEvent = (event: Event) => {
    if (!isHTMLElement(event.target)) {
        return "";
    }
    const sourceElement = event.target.closest("[data-source-id]");
    if (!isHTMLElement(sourceElement)) {
        return "";
    }
    return (sourceElement.getAttribute("data-source-id") || "").trim();
};

/** 用途：从自定义事件读取 sourceID。意图：兼容外部切源事件。调用时机：监听 hub set-source 事件。问题/改进：当前只读取 detail.sourceID。 */
/** 导出 readSourceIDFromHubEvent 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const readSourceIDFromHubEvent = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
        return "";
    }
    return readStringField(event.detail, "sourceID");
};

/** 用途：按 ID 查找源配置。意图：统一查找逻辑。调用时机：渲染和动作处理中。问题/改进：当前为线性查找。 */
/** 导出 findSourceByID 供 hub 控制器和渲染复用 */
/** @同步豁免: UI构建 */
export const findSourceByID = (bundle: IBazaarWorkspaceBundle | null, sourceID: string) => {
    if (!bundle) {
        return null;
    }
    return bundle.workspace.sources.find((item) => item.id === sourceID) || null;
};

/** 用途：选择默认源。意图：统一源选择优先级。调用时机：刷新工作空间后。问题/改进：后续可支持权重排序。 */
/** 导出 pickDefaultSource 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const pickDefaultSource = (bundle: IBazaarWorkspaceBundle, preferredSourceID: string) => {
    const sources = bundle.workspace.sources;
    if (!sources.length) {
        return "";
    }
    const preferred = sources.find((item) => item.id === preferredSourceID && item.enabled);
    if (preferred) {
        return preferred.id;
    }
    const configured = sources.find((item) => item.id === bundle.workspace.hub.defaultSourceID && item.enabled);
    if (configured) {
        return configured.id;
    }
    const firstEnabled = sources.find((item) => item.enabled);
    if (firstEnabled) {
        return firstEnabled.id;
    }
    const firstSource = sources[0];
    return firstSource.id;
};

/** 用途：按关键词过滤包列表。意图：渲染前先做纯数据过滤。调用时机：渲染包列表前。问题/改进：当前为简单包含匹配。 */
const filterPackages = (items: IBazaarPublishedItem[], keyword: string) => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
        return items;
    }
    return items.filter((item) => {
        const searchable = `${item.displayName} ${item.packageName} ${item.packageType} ${item.description} ${item.author} ${item.version}`;
        return searchable.toLowerCase().includes(normalized);
    });
};

/** 用途：格式化发布时间。意图：统一时间文本展示。调用时机：渲染包卡片。问题/改进：使用浏览器本地时区。 */
const formatDateTime = (timestamp: number) => {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
};

/** 用途：渲染 hub 静态骨架。意图：初始化时一次性输出结构。调用时机：hub 初始化入口。问题/改进：文案当前固定中文。 */
/** 导出 renderHubLayout 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const renderHubLayout = (container: HTMLElement) => {
    container.innerHTML = `<div class="bazaar-hub__layout">
    <aside class="bazaar-hub__sidebar">
        <div class="bazaar-hub__sidebar-title">第三方集市源</div>
        <div class="bazaar-hub__source-list"></div>
    </aside>
    <section class="bazaar-hub__main">
        <header class="bazaar-hub__toolbar">
            <div class="bazaar-hub__toolbar-left">
                <button class="b3-button" data-type="open-publish">发布设置</button>
                <button class="b3-button b3-button--outline" data-type="open-local-source-page">本地集市源</button>
                <button class="b3-button b3-button--outline" data-type="open-official-config">官方集市设置</button>
            </div>
            <div class="bazaar-hub__toolbar-right">
                <div class="b3-form__icon"><svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                    <input class="b3-text-field b3-form__icon-input" data-type="search-package" placeholder="筛选包名 / 作者 / 类型"></div>
                <button class="b3-button b3-button--outline" data-type="refresh-hub">刷新</button>
            </div>
        </header>
        <div class="bazaar-hub__summary"></div>
        <div class="bazaar-hub__package-list"></div>
    </section>
</div>`;
};

/** 用途：查询必需 DOM 元素。意图：集中处理查询失败保护。调用时机：layout 渲染后提取节点。问题/改进：当前失败时抛异常。 */
/** 导出 queryRequiredElement 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const queryRequiredElement = (container: HTMLElement, selector: string) => {
    const element = container.querySelector(selector);
    if (isHTMLElement(element)) {
        return element;
    }
    throw new Error(`missing required element: ${selector}`);
};

/** 用途：查询搜索输入框。意图：统一输入框类型校验。调用时机：绑定 input 事件前。问题/改进：当前仅支持原生 input。 */
/** 导出 querySearchInput 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const querySearchInput = (container: HTMLElement) => {
    const element = container.querySelector('input[data-type="search-package"]');
    if (element instanceof HTMLInputElement) {
        return element;
    }
    return null;
};

/** 用途：渲染摘要区域。意图：展示当前源与源连接状态。调用时机：刷新工作空间与切源后。问题/改进：当前为纯文本摘要。 */
/** 导出 renderSummary 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const renderSummary = (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
}, summaryElement: HTMLElement) => {
    if (!state.bundle) {
        summaryElement.textContent = "正在加载集市源...";
        return;
    }
    const source = findSourceByID(state.bundle, state.sourceID);
    const total = state.bundle.workspace.sources.length;
    const enabled = state.bundle.workspace.sources.filter((item) => item.enabled).length;
    if (!source) {
        summaryElement.textContent = `已连接 ${total} 个源，启用 ${enabled} 个。请选择一个源开始浏览包。`;
        return;
    }
    summaryElement.textContent = `当前源：${source.name || source.url} · ${source.url} · 已连接 ${total} 个源 / 启用 ${enabled} 个源`;
};

/** 用途：渲染源列表。意图：集中处理加载态、空态和列表态。调用时机：刷新工作空间与切源后。问题/改进：当前每次全量重建列表。 */
/** 导出 renderSourceList 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const renderSourceList = (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
}, sourceListElement: HTMLElement) => {
    if (!state.bundle) {
        sourceListElement.innerHTML = "<div class=\"bazaar-hub__empty\">正在加载...</div>";
        return;
    }
    const sourceCount = state.bundle.workspace.sources.length;
    if (!sourceCount) {
        sourceListElement.innerHTML = "<div class=\"bazaar-hub__empty\">尚未连接第三方集市源，请先在“发布设置”中添加。</div>";
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const source of state.bundle.workspace.sources) {
        const item = document.createElement("div");
        item.className = `bazaar-hub__source-item${source.id === state.sourceID ? " bazaar-hub__source-item--active" : ""}`;
        if (!source.enabled) {
            item.classList.add("bazaar-hub__source-item--disabled");
        }

        const infoButton = document.createElement("button");
        infoButton.className = "bazaar-hub__source-main";
        infoButton.setAttribute("data-type", "select-source");
        infoButton.setAttribute("data-source-id", source.id);

        const title = document.createElement("div");
        title.className = "bazaar-hub__source-name";
        title.textContent = source.name || source.url;

        const urlElement = document.createElement("div");
        urlElement.className = "bazaar-hub__source-url";
        urlElement.textContent = source.url;

        infoButton.appendChild(title);
        infoButton.appendChild(urlElement);

        const actions = document.createElement("div");
        actions.className = "bazaar-hub__source-actions";

        const openTabButton = document.createElement("button");
        openTabButton.className = "b3-button b3-button--small b3-button--outline";
        openTabButton.setAttribute("data-type", "open-source-tab");
        openTabButton.setAttribute("data-source-id", source.id);
        openTabButton.textContent = "Tab";

        actions.appendChild(openTabButton);
        item.appendChild(infoButton);
        item.appendChild(actions);
        fragment.appendChild(item);
    }

    sourceListElement.innerHTML = "";
    sourceListElement.appendChild(fragment);
};

/** 用途：渲染包列表空态消息。意图：统一空态样式和文案输出。调用时机：加载中/失败/无数据场景。问题/改进：后续可加入重试按钮。 */
/** 导出 setPackageMessage 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const setPackageMessage = (packageListElement: HTMLElement, message: string) => {
    packageListElement.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "bazaar-hub__empty";
    empty.textContent = message;
    packageListElement.appendChild(empty);
};

/** 用途：构建包卡片动作按钮。意图：从卡片构建函数中拆分动作区，降低单函数行数。调用时机：createPackageCard 内部调用。问题/改进：当前动作固定为安装和打开源站。 */
const createPackageActions = (pkg: IBazaarPublishedItem, source: Config.IBazaarSource) => {
    const actions = document.createElement("div");
    actions.className = "bazaar-hub__package-actions";

    const installButton = document.createElement("button");
    installButton.className = "b3-button";
    installButton.setAttribute("data-type", "install-package");
    installButton.setAttribute("data-source-id", source.id);
    installButton.setAttribute("data-package-type", pkg.packageType);
    installButton.setAttribute("data-package-name", pkg.packageName);
    installButton.setAttribute("data-version", pkg.version);
    installButton.textContent = "安装";

    const installDisabled = !source.allowInstall || !source.enabled;
    if (installDisabled) {
        installButton.setAttribute("disabled", "disabled");
    }

    const openButton = document.createElement("button");
    openButton.className = "b3-button b3-button--outline";
    openButton.setAttribute("data-type", "open-source-tab");
    openButton.setAttribute("data-source-id", source.id);
    openButton.textContent = "打开源站";

    actions.appendChild(installButton);
    actions.appendChild(openButton);
    return actions;
};

/** 用途：创建包卡片节点。意图：封装包项 DOM 构建细节。调用时机：渲染包列表时。问题/改进：当前为全量重建。 */
const createPackageCard = (pkg: IBazaarPublishedItem, source: Config.IBazaarSource) => {
    const card = document.createElement("article");
    card.className = "bazaar-hub__package-card";

    const header = document.createElement("div");
    header.className = "bazaar-hub__package-header";
    const title = document.createElement("div");
    title.className = "bazaar-hub__package-title";
    title.textContent = pkg.displayName || pkg.packageName;
    const meta = document.createElement("div");
    meta.className = "bazaar-hub__package-meta";
    meta.textContent = `${pkg.packageType} · ${pkg.packageName} · v${pkg.version}`;

    const description = document.createElement("div");
    description.className = "bazaar-hub__package-desc";
    description.textContent = pkg.description || "暂无描述";

    const footer = document.createElement("div");
    footer.className = "bazaar-hub__package-footer";
    const author = document.createElement("span");
    author.textContent = `作者：${pkg.author || "-"}`;
    const published = document.createElement("span");
    published.textContent = `发布：${formatDateTime(pkg.publishedAt)}`;
    footer.appendChild(author);
    footer.appendChild(published);

    const actions = createPackageActions(pkg, source);

    header.appendChild(title);
    header.appendChild(meta);
    card.appendChild(header);
    card.appendChild(description);
    card.appendChild(footer);
    card.appendChild(actions);
    return card;
};

/** 用途：渲染包列表区域。意图：统一源未选中、加载中、空结果和正常列表。调用时机：加载索引和关键词变化时。问题/改进：当前按关键词全量过滤。 */
/** 导出 renderPackageList 供 hub 控制器复用 */
/** @同步豁免: UI构建 */
export const renderPackageList = (state: {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}, packageListElement: HTMLElement) => {
    const source = findSourceByID(state.bundle, state.sourceID);
    if (!source) {
        setPackageMessage(packageListElement, "请选择左侧源。");
        return;
    }
    if (!state.packageIndex) {
        setPackageMessage(packageListElement, "正在读取源包索引...");
        return;
    }

    const filtered = filterPackages(state.packageIndex.packages || [], state.keyword);
    if (!filtered.length) {
        setPackageMessage(packageListElement, "没有匹配的包。");
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const pkg of filtered) {
        fragment.appendChild(createPackageCard(pkg, source));
    }
    packageListElement.innerHTML = "";
    packageListElement.appendChild(fragment);
};
