import { showMessage } from "../dialog/message";
import { openSetting } from "../config";
import { getFrontend } from "../util/platform/functions";
import { isHTMLElement } from "../util/DOM/element.guard";
import type { Custom } from "../layout/dock/Custom";
import {
    getBazaarSourcePackages,
    getBazaarWorkspaceBundle,
    installBazaarPackageFromSource,
} from "./api";
import { BAZAAR_HUB_SET_SOURCE_EVENT } from "./constants";
import { openBazaarPublishTab, openBazaarSourceTab, openLocalBazaarSourceTab } from "./open";
import type { IBazaarPublishedIndex, IBazaarPublishedItem, IBazaarWorkspaceBundle } from "./types";

interface IHubTabData {
    sourceID?: string;
}

interface IHubState {
    bundle: IBazaarWorkspaceBundle | null;
    sourceID: string;
    packageIndex: IBazaarPublishedIndex | null;
    keyword: string;
}

const parseHubData = (data: unknown): IHubTabData => {
    if (!data || typeof data !== "object") {
        return {};
    }
    return data as IHubTabData;
};

const formatDateTime = (timestamp: number): string => {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
};

const readSourceID = (event: Event): string => {
    const target = event.target as HTMLElement;
    if (!target) {
        return "";
    }
    const node = target.closest<HTMLElement>("[data-source-id]");
    return (node?.getAttribute("data-source-id") || "").trim();
};

const findSourceByID = (bundle: IBazaarWorkspaceBundle | null, sourceID: string): Config.IBazaarSource | null => {
    if (!bundle) {
        return null;
    }
    return bundle.workspace.sources.find((item) => item.id === sourceID) || null;
};

const pickDefaultSource = (bundle: IBazaarWorkspaceBundle, preferredSourceID: string): string => {
    const sources = bundle.workspace.sources;
    if (!sources.length) {
        return "";
    }
    const byPreferred = sources.find((item) => item.id === preferredSourceID && item.enabled);
    if (byPreferred) {
        return byPreferred.id;
    }
    const byConfig = sources.find((item) => item.id === bundle.workspace.hub.defaultSourceID && item.enabled);
    if (byConfig) {
        return byConfig.id;
    }
    const firstEnabled = sources.find((item) => item.enabled);
    if (firstEnabled) {
        return firstEnabled.id;
    }
    return sources[0].id;
};

const filterPackages = (items: IBazaarPublishedItem[], keyword: string): IBazaarPublishedItem[] => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
        return items;
    }
    return items.filter((item) => {
        const fields = [
            item.displayName,
            item.packageName,
            item.packageType,
            item.description,
            item.author,
            item.version,
        ].join(" ").toLowerCase();
        return fields.includes(normalized);
    });
};

export function initBazaarHub(model: Custom): void {
    if (!isHTMLElement(model.element)) {
        return;
    }
    const container = model.element;
    container.classList.add("bazaar-hub");

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
                <div class="b3-form__icon">
                    <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
                    <input class="b3-text-field b3-form__icon-input" data-type="search-package" placeholder="筛选包名 / 作者 / 类型">
                </div>
                <button class="b3-button b3-button--outline" data-type="refresh-hub">刷新</button>
            </div>
        </header>
        <div class="bazaar-hub__summary"></div>
        <div class="bazaar-hub__package-list"></div>
    </section>
</div>`;

    const sourceListElement = container.querySelector(".bazaar-hub__source-list") as HTMLElement;
    const summaryElement = container.querySelector(".bazaar-hub__summary") as HTMLElement;
    const packageListElement = container.querySelector(".bazaar-hub__package-list") as HTMLElement;
    const searchInput = container.querySelector<HTMLInputElement>('input[data-type="search-package"]');

    const state: IHubState = {
        bundle: null,
        sourceID: parseHubData(model.data).sourceID || "",
        packageIndex: null,
        keyword: "",
    };

    const renderSummary = () => {
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

    const renderSourceList = () => {
        if (!state.bundle) {
            sourceListElement.innerHTML = `<div class="bazaar-hub__empty">正在加载...</div>`;
            return;
        }
        if (!state.bundle.workspace.sources.length) {
            sourceListElement.innerHTML = `<div class="bazaar-hub__empty">尚未连接第三方集市源，请先在“发布设置”中添加。</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const source of state.bundle.workspace.sources) {
            const item = document.createElement("div");
            item.className = `bazaar-hub__source-item${source.id === state.sourceID ? " bazaar-hub__source-item--active" : ""}`;
            if (!source.enabled) {
                item.classList.add("bazaar-hub__source-item--disabled");
            }

            const infoBtn = document.createElement("button");
            infoBtn.className = "bazaar-hub__source-main";
            infoBtn.setAttribute("data-type", "select-source");
            infoBtn.setAttribute("data-source-id", source.id);

            const title = document.createElement("div");
            title.className = "bazaar-hub__source-name";
            title.textContent = source.name || source.url;

            const sub = document.createElement("div");
            sub.className = "bazaar-hub__source-url";
            sub.textContent = source.url;

            infoBtn.appendChild(title);
            infoBtn.appendChild(sub);

            const actions = document.createElement("div");
            actions.className = "bazaar-hub__source-actions";
            const tabBtn = document.createElement("button");
            tabBtn.className = "b3-button b3-button--small b3-button--outline";
            tabBtn.setAttribute("data-type", "open-source-tab");
            tabBtn.setAttribute("data-source-id", source.id);
            tabBtn.textContent = "Tab";
            actions.appendChild(tabBtn);

            item.appendChild(infoBtn);
            item.appendChild(actions);
            fragment.appendChild(item);
        }
        sourceListElement.innerHTML = "";
        sourceListElement.appendChild(fragment);
    };

    const renderPackageList = () => {
        const source = findSourceByID(state.bundle, state.sourceID);
        if (!source) {
            packageListElement.innerHTML = `<div class="bazaar-hub__empty">请选择左侧源。</div>`;
            return;
        }
        if (!state.packageIndex) {
            packageListElement.innerHTML = `<div class="bazaar-hub__empty">正在读取源包索引...</div>`;
            return;
        }

        const filtered = filterPackages(state.packageIndex.packages || [], state.keyword);
        if (!filtered.length) {
            packageListElement.innerHTML = `<div class="bazaar-hub__empty">没有匹配的包。</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const pkg of filtered) {
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

            const desc = document.createElement("div");
            desc.className = "bazaar-hub__package-desc";
            desc.textContent = pkg.description || "暂无描述";

            const footer = document.createElement("div");
            footer.className = "bazaar-hub__package-footer";
            const authorElement = document.createElement("span");
            authorElement.textContent = `作者：${pkg.author || "-"}`;
            const publishElement = document.createElement("span");
            publishElement.textContent = `发布：${formatDateTime(pkg.publishedAt)}`;
            footer.appendChild(authorElement);
            footer.appendChild(publishElement);

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
            if (!source.allowInstall || !source.enabled) {
                installButton.setAttribute("disabled", "disabled");
            }

            const openButton = document.createElement("button");
            openButton.className = "b3-button b3-button--outline";
            openButton.setAttribute("data-type", "open-source-tab");
            openButton.setAttribute("data-source-id", source.id);
            openButton.textContent = "打开源站";

            actions.appendChild(installButton);
            actions.appendChild(openButton);

            header.appendChild(title);
            header.appendChild(meta);
            card.appendChild(header);
            card.appendChild(desc);
            card.appendChild(footer);
            card.appendChild(actions);
            fragment.appendChild(card);
        }

        packageListElement.innerHTML = "";
        packageListElement.appendChild(fragment);
    };

    const setPackageMessage = (message: string) => {
        packageListElement.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "bazaar-hub__empty";
        empty.textContent = message;
        packageListElement.appendChild(empty);
    };

    const loadSourcePackages = async () => {
        const source = findSourceByID(state.bundle, state.sourceID);
        if (!source) {
            state.packageIndex = null;
            renderPackageList();
            return;
        }
        if (!source.enabled) {
            state.packageIndex = { updatedAt: Date.now(), packages: [] };
            renderPackageList();
            setPackageMessage("当前源已禁用。");
            return;
        }
        setPackageMessage("正在读取源包索引...");
        try {
            state.packageIndex = await getBazaarSourcePackages(source.id);
            renderPackageList();
        } catch (error) {
            state.packageIndex = null;
            setPackageMessage(`读取失败：${(error as Error).message}`);
        }
    };

    const refreshWorkspace = async () => {
        try {
            state.bundle = await getBazaarWorkspaceBundle();
            state.sourceID = pickDefaultSource(state.bundle, state.sourceID);
            renderSourceList();
            renderSummary();
            await loadSourcePackages();
        } catch (error) {
            showMessage((error as Error).message);
            renderSourceList();
            renderSummary();
            setPackageMessage("集市广场加载失败。");
        }
    };

    const openCurrentSourceTab = () => {
        if (!state.bundle) {
            return;
        }
        const source = findSourceByID(state.bundle, state.sourceID);
        if (!source) {
            return;
        }
        if (!source.openInTab) {
            showMessage("该源已禁止在 Tab 中打开");
            return;
        }
        void openBazaarSourceTab({
            app: model.app,
            source: {
                id: source.id,
                name: source.name,
                url: source.url,
                openInTab: source.openInTab,
            },
        });
    };

    container.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target) {
            return;
        }
        const type = target.closest<HTMLElement>("[data-type]")?.getAttribute("data-type");
        if (!type) {
            return;
        }

        if (type === "open-publish") {
            void openBazaarPublishTab({ app: model.app });
            return;
        }
        if (type === "open-local-source-page") {
            void openLocalBazaarSourceTab({ app: model.app });
            return;
        }
        if (type === "open-official-config") {
            const settingDialog = openSetting(model.app);
            settingDialog?.element.querySelector('.b3-tab-bar [data-name="bazaar"]')?.dispatchEvent(new CustomEvent("click"));
            return;
        }
        if (type === "refresh-hub") {
            void refreshWorkspace();
            return;
        }
        if (type === "select-source") {
            const nextSourceID = readSourceID(event);
            if (!nextSourceID || nextSourceID === state.sourceID) {
                return;
            }
            state.sourceID = nextSourceID;
            renderSourceList();
            renderSummary();
            void loadSourcePackages();
            return;
        }
        if (type === "open-source-tab") {
            const sourceID = readSourceID(event) || state.sourceID;
            if (sourceID && state.bundle) {
                const source = findSourceByID(state.bundle, sourceID);
                if (source) {
                    if (!source.openInTab) {
                        showMessage("该源已禁止在 Tab 中打开");
                        return;
                    }
                    void openBazaarSourceTab({
                        app: model.app,
                        source: {
                            id: source.id,
                            name: source.name,
                            url: source.url,
                            openInTab: source.openInTab,
                        },
                    });
                    return;
                }
            }
            openCurrentSourceTab();
            return;
        }
        if (type === "install-package") {
            const actionElement = target.closest<HTMLElement>('[data-type="install-package"]');
            if (!actionElement || !state.bundle) {
                return;
            }
            const sourceID = actionElement.getAttribute("data-source-id") || state.sourceID;
            const packageType = actionElement.getAttribute("data-package-type") || "";
            const packageName = actionElement.getAttribute("data-package-name") || "";
            const version = actionElement.getAttribute("data-version") || "";
            if (!sourceID || !packageType || !packageName) {
                return;
            }

            actionElement.setAttribute("disabled", "disabled");
            void installBazaarPackageFromSource({
                sourceID,
                packageType,
                packageName,
                version,
                mode: window.siyuan.config.appearance.mode,
                frontend: getFrontend(),
            }).then(() => {
                showMessage(`已安装 ${packageName}`);
            }).catch((error) => {
                showMessage((error as Error).message);
            }).finally(() => {
                actionElement.removeAttribute("disabled");
            });
        }
    });

    searchInput?.addEventListener("input", () => {
        state.keyword = searchInput.value;
        renderPackageList();
    });

    container.addEventListener(BAZAAR_HUB_SET_SOURCE_EVENT, (event: Event) => {
        const customEvent = event as CustomEvent<{ sourceID?: string }>;
        const nextSourceID = (customEvent.detail?.sourceID || "").trim();
        if (!nextSourceID || nextSourceID === state.sourceID) {
            return;
        }
        state.sourceID = nextSourceID;
        renderSourceList();
        renderSummary();
        void loadSourcePackages();
    });

    void refreshWorkspace();
}
