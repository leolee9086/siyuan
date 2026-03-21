import { confirmDialog } from "../dialog/confirmDialog";
import { showMessage } from "../dialog/message";
import { isHTMLElement } from "../util/DOM/element.guard";
import { escapeAttr, escapeHtml } from "../util/DOM/escape";
import type { Custom } from "../layout/dock/Custom";
import {
    getBazaarSecurityStats,
    getBazaarWorkspaceBundle,
    publishBazaarPackage,
    removeBazaarSource,
    setBazaarPublishConfig,
    testBazaarSource,
    upsertBazaarSource,
} from "./api";
import { openBazaarHubTab, openBazaarSourceTab, openLocalBazaarSourceTab } from "./open";
import type { IBazaarSecurityStats, IBazaarWorkspaceBundle } from "./types";

interface IPublishState {
    bundle: IBazaarWorkspaceBundle | null;
    stats: IBazaarSecurityStats | null;
}

const formatDateTime = (timestamp: number): string => {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
};

const packageTypeLabel = (packageType: string): string => {
    const map: Record<string, string> = {
        plugins: "插件",
        widgets: "挂件",
        themes: "主题",
        icons: "图标",
        templates: "模板",
    };
    return map[packageType] || packageType;
};

const parseNumber = (value: string, fallback: number): number => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return fallback;
    }
    return parsed;
};

const readSourceID = (event: Event): string => {
    const target = event.target as HTMLElement;
    if (!target) {
        return "";
    }
    return (target.closest<HTMLElement>("[data-source-id]")?.getAttribute("data-source-id") || "").trim();
};

const renderSourceOptions = (bundle: IBazaarWorkspaceBundle): string => {
    const options = [`<option value="">(自动)</option>`];
    for (const source of bundle.workspace.sources) {
        const selected = source.id === bundle.workspace.hub.defaultSourceID ? " selected" : "";
        options.push(`<option value="${escapeAttr(source.id)}"${selected}>${escapeHtml(source.name || source.url)}</option>`);
    }
    return options.join("");
};

const renderSourceRows = (bundle: IBazaarWorkspaceBundle): string => {
    if (!bundle.workspace.sources.length) {
        return `<tr><td colspan="4" class="bazaar-publish__empty-cell">暂无第三方源</td></tr>`;
    }
    return bundle.workspace.sources.map((source) => {
        return `<tr>
    <td>
        <div class="bazaar-publish__source-name">${escapeHtml(source.name || source.url)}</div>
        <div class="bazaar-publish__source-url">${escapeHtml(source.url)}</div>
    </td>
    <td>
        <span class="b3-chip ${source.enabled ? "b3-chip--primary" : ""}">${source.enabled ? "启用" : "禁用"}</span>
        <span class="b3-chip ${source.allowInstall ? "b3-chip--primary" : ""}">${source.allowInstall ? "可安装" : "仅浏览"}</span>
    </td>
    <td>${formatDateTime(source.updatedAt || source.createdAt)}</td>
    <td class="bazaar-publish__row-actions">
        <button class="b3-button b3-button--small b3-button--outline" data-type="edit-source" data-source-id="${escapeAttr(source.id)}">编辑</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="test-source" data-source-id="${escapeAttr(source.id)}">测试</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="open-source-tab" data-source-id="${escapeAttr(source.id)}">打开 Tab</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="browse-source" data-source-id="${escapeAttr(source.id)}">浏览包</button>
        <button class="b3-button b3-button--small b3-button--cancel" data-type="remove-source" data-source-id="${escapeAttr(source.id)}">移除</button>
    </td>
</tr>`;
    }).join("");
};

const renderInstalledRows = (bundle: IBazaarWorkspaceBundle): string => {
    const rows: string[] = [];
    for (const [packageType, list] of Object.entries(bundle.workspace.installed || {})) {
        for (const item of list || []) {
            rows.push(`<tr>
    <td>${packageTypeLabel(packageType)}</td>
    <td>
        <div class="bazaar-publish__source-name">${escapeHtml(item.preferredName || item.name)}</div>
        <div class="bazaar-publish__source-url">${escapeHtml(item.name)}</div>
    </td>
    <td>v${escapeHtml(item.version || "-")}</td>
    <td>${escapeHtml(item.author || "-")}</td>
    <td>
        <button class="b3-button b3-button--small" data-type="publish-package" data-package-type="${escapeAttr(packageType)}" data-package-name="${escapeAttr(item.name)}">发布</button>
    </td>
</tr>`);
        }
    }
    if (!rows.length) {
        return `<tr><td colspan="5" class="bazaar-publish__empty-cell">当前工作空间暂无已安装包</td></tr>`;
    }
    return rows.join("");
};

const renderPublishedRows = (bundle: IBazaarWorkspaceBundle): string => {
    const packages = bundle.published.packages || [];
    if (!packages.length) {
        return `<tr><td colspan="5" class="bazaar-publish__empty-cell">暂无发布记录</td></tr>`;
    }
    return packages.map((item) => {
        return `<tr>
    <td>${packageTypeLabel(item.packageType)}</td>
    <td>${escapeHtml(item.displayName || item.packageName)}</td>
    <td>v${escapeHtml(item.version || "-")}</td>
    <td>${formatDateTime(item.publishedAt)}</td>
    <td>${item.officialName ? "<span class=\"b3-chip b3-chip--warning\">与官方重名</span>" : "-"}</td>
</tr>`;
    }).join("");
};

const renderSecurityStats = (stats: IBazaarSecurityStats | null): string => {
    if (!stats) {
        return `<div class="bazaar-publish__muted">暂无统计数据</div>`;
    }
    const clients = stats.clients || [];
    const clientRows = clients.length ? clients.map((item) => {
        return `<tr>
    <td>${escapeHtml(item.ip)}</td>
    <td>${item.accepted}</td>
    <td>${item.rejected}</td>
    <td>${formatDateTime(item.lastSeen)}</td>
</tr>`;
    }).join("") : `<tr><td colspan="4" class="bazaar-publish__empty-cell">暂无客户端请求记录</td></tr>`;

    return `<div class="bazaar-publish__stats-head">
    <span>通过请求：<strong>${stats.totalAccepted}</strong></span>
    <span>拒绝请求：<strong>${stats.totalRejected}</strong></span>
</div>
<table class="b3-table">
    <thead><tr><th>IP</th><th>通过</th><th>拒绝</th><th>最近请求</th></tr></thead>
    <tbody>${clientRows}</tbody>
</table>`;
};

const findSourceByID = (bundle: IBazaarWorkspaceBundle | null, sourceID: string): Config.IBazaarSource | null => {
    if (!bundle) {
        return null;
    }
    return bundle.workspace.sources.find((item) => item.id === sourceID) || null;
};

export function initBazaarPublish(model: Custom): void {
    if (!isHTMLElement(model.element)) {
        return;
    }
    const container = model.element;
    container.classList.add("bazaar-publish");

    const state: IPublishState = {
        bundle: null,
        stats: null,
    };

    const renderLoading = () => {
        container.innerHTML = `<div class="bazaar-publish__loading">正在加载发布配置...</div>`;
    };

    const render = () => {
        if (!state.bundle) {
            renderLoading();
            return;
        }
        const bundle = state.bundle;
        const publish = bundle.workspace.publish;
        const security = bundle.workspace.security;
        const hub = bundle.workspace.hub;

        container.innerHTML = `<div class="bazaar-publish__layout">
    <header class="bazaar-publish__header">
        <div class="bazaar-publish__title">集市发布设置</div>
        <div class="bazaar-publish__header-actions">
            <button class="b3-button b3-button--outline" data-type="open-hub">打开集市广场</button>
            <button class="b3-button b3-button--outline" data-type="open-local-source-page">打开集市源页面</button>
            <button class="b3-button b3-button--outline" data-type="refresh-publish">刷新</button>
        </div>
    </header>

    <section class="bazaar-publish__section">
        <h3>发布与鉴权</h3>
        <div class="bazaar-publish__grid">
            <label class="b3-label b3-label--inner"><span>启用发布</span><input id="bazaarPublishEnabled" class="b3-switch" type="checkbox"${publish.enabled ? " checked" : ""}></label>
            <label class="b3-label b3-label--inner"><span>公开接口需要鉴权</span><input id="bazaarPublishRequireAuth" class="b3-switch" type="checkbox"${publish.requireAuth ? " checked" : ""}></label>
            <label class="b3-label b3-label--inner"><span>最小暴露模式</span><input id="bazaarPublishMinExpose" class="b3-switch" type="checkbox"${publish.minExpose ? " checked" : ""}></label>
            <label class="b3-label b3-label--inner"><span>允许与官方同名</span><input id="bazaarPublishAllowCollision" class="b3-switch" type="checkbox"${publish.allowOfficialNameCollision ? " checked" : ""}></label>
        </div>
        <div class="bazaar-publish__field">
            <div class="bazaar-publish__field-label">发布令牌（X-Bazaar-Token / Bearer）</div>
            <input id="bazaarPublishAuthToken" class="b3-text-field fn__block" type="password" autocomplete="new-password" value="${escapeAttr(publish.authToken || "")}" placeholder="留空表示仅允许工作空间 API token / MAGI 身份令牌">
        </div>
    </section>

    <section class="bazaar-publish__section">
        <h3>安全防护（限流）</h3>
        <div class="bazaar-publish__grid">
            <label class="b3-label b3-label--inner"><span>启用限流</span><input id="bazaarSecurityEnableRateLimit" class="b3-switch" type="checkbox"${security.enableRateLimit ? " checked" : ""}></label>
            <label class="b3-label b3-label--inner">
                <span>每分钟请求数</span>
                <input id="bazaarSecurityRPM" class="b3-text-field" type="number" min="1" value="${security.requestsPerMinute}">
            </label>
            <label class="b3-label b3-label--inner">
                <span>Burst</span>
                <input id="bazaarSecurityBurst" class="b3-text-field" type="number" min="1" value="${security.burst}">
            </label>
            <label class="b3-label b3-label--inner">
                <span>窗口秒数</span>
                <input id="bazaarSecurityWindowSeconds" class="b3-text-field" type="number" min="1" value="${security.windowSeconds}">
            </label>
        </div>
        <div class="bazaar-publish__stats">${renderSecurityStats(state.stats)}</div>
    </section>

    <section class="bazaar-publish__section">
        <h3>广场偏好</h3>
        <div class="bazaar-publish__grid">
            <label class="b3-label b3-label--inner"><span>显示官方入口</span><input id="bazaarHubShowOfficial" class="b3-switch" type="checkbox"${hub.showOfficial ? " checked" : ""}></label>
            <label class="b3-label b3-label--inner">
                <span>默认第三方源</span>
                <select id="bazaarHubDefaultSource" class="b3-select">${renderSourceOptions(bundle)}</select>
            </label>
        </div>
    </section>

    <section class="bazaar-publish__section">
        <button class="b3-button" data-type="save-config">保存发布配置</button>
    </section>

    <section class="bazaar-publish__section">
        <h3>第三方集市源管理</h3>
        <div class="bazaar-publish__source-form">
            <input id="bazaarSourceID" class="fn__none">
            <input id="bazaarSourceName" class="b3-text-field" placeholder="名称（可空）">
            <input id="bazaarSourceURL" class="b3-text-field" placeholder="URL，例如 https://example.com">
            <input id="bazaarSourceToken" class="b3-text-field" type="password" autocomplete="new-password" placeholder="可选令牌">
            <label class="b3-label b3-label--inner"><span>启用</span><input id="bazaarSourceEnabled" class="b3-switch" type="checkbox" checked></label>
            <label class="b3-label b3-label--inner"><span>允许安装</span><input id="bazaarSourceAllowInstall" class="b3-switch" type="checkbox" checked></label>
            <label class="b3-label b3-label--inner"><span>允许在 Tab 中打开</span><input id="bazaarSourceOpenInTab" class="b3-switch" type="checkbox" checked></label>
            <button class="b3-button" data-type="save-source">保存源</button>
            <button class="b3-button b3-button--outline" data-type="reset-source">清空</button>
        </div>
        <table class="b3-table">
            <thead>
                <tr><th>源</th><th>能力</th><th>更新时间</th><th>操作</th></tr>
            </thead>
            <tbody>${renderSourceRows(bundle)}</tbody>
        </table>
    </section>

    <section class="bazaar-publish__section">
        <h3>当前工作空间可发布包</h3>
        <table class="b3-table">
            <thead><tr><th>类型</th><th>包名</th><th>版本</th><th>作者</th><th>操作</th></tr></thead>
            <tbody>${renderInstalledRows(bundle)}</tbody>
        </table>
    </section>

    <section class="bazaar-publish__section">
        <h3>发布记录</h3>
        <table class="b3-table">
            <thead><tr><th>类型</th><th>名称</th><th>版本</th><th>发布时间</th><th>提示</th></tr></thead>
            <tbody>${renderPublishedRows(bundle)}</tbody>
        </table>
    </section>
</div>`;
    };

    const loadAll = async () => {
        renderLoading();
        try {
            const [bundle, stats] = await Promise.all([
                getBazaarWorkspaceBundle(),
                getBazaarSecurityStats(),
            ]);
            state.bundle = bundle;
            state.stats = stats;
            render();
        } catch (error) {
            container.innerHTML = `<div class="bazaar-publish__loading">加载失败：${escapeHtml((error as Error).message)}</div>`;
        }
    };

    const readInput = <T extends HTMLElement>(selector: string): T | null => {
        return container.querySelector(selector) as T | null;
    };

    const buildPublishPayloadFromForm = (): {
        publish: Config.IBazaarPublish;
        security: Config.IBazaarSecurity;
        hub: Config.IBazaarHubPreference;
    } | null => {
        if (!state.bundle) {
            return null;
        }
        const publishEnabled = readInput<HTMLInputElement>("#bazaarPublishEnabled")?.checked || false;
        const requireAuth = readInput<HTMLInputElement>("#bazaarPublishRequireAuth")?.checked || false;
        const minExpose = readInput<HTMLInputElement>("#bazaarPublishMinExpose")?.checked || false;
        const allowCollision = readInput<HTMLInputElement>("#bazaarPublishAllowCollision")?.checked || false;
        const authToken = readInput<HTMLInputElement>("#bazaarPublishAuthToken")?.value || "";

        const enableRateLimit = readInput<HTMLInputElement>("#bazaarSecurityEnableRateLimit")?.checked || false;
        const requestsPerMinute = parseNumber(readInput<HTMLInputElement>("#bazaarSecurityRPM")?.value || "", 120);
        const burst = parseNumber(readInput<HTMLInputElement>("#bazaarSecurityBurst")?.value || "", 30);
        const windowSeconds = parseNumber(readInput<HTMLInputElement>("#bazaarSecurityWindowSeconds")?.value || "", 60);

        const showOfficial = readInput<HTMLInputElement>("#bazaarHubShowOfficial")?.checked || false;
        const defaultSourceID = readInput<HTMLSelectElement>("#bazaarHubDefaultSource")?.value || "";

        const publish: Config.IBazaarPublish = {
            ...state.bundle.workspace.publish,
            enabled: publishEnabled,
            requireAuth,
            minExpose,
            allowOfficialNameCollision: allowCollision,
            authToken,
        };
        const security: Config.IBazaarSecurity = {
            ...state.bundle.workspace.security,
            enableRateLimit,
            requestsPerMinute,
            burst,
            windowSeconds,
        };
        const hub: Config.IBazaarHubPreference = {
            ...state.bundle.workspace.hub,
            showOfficial,
            defaultSourceID,
        };
        return { publish, security, hub };
    };

    const syncPublishConfigFromForm = async (showSavedMessage: boolean): Promise<boolean> => {
        if (!state.bundle) {
            return false;
        }
        const payload = buildPublishPayloadFromForm();
        if (!payload) {
            return false;
        }
        const workspace = await setBazaarPublishConfig(payload);
        state.bundle = {
            ...state.bundle,
            workspace,
        };
        if (showSavedMessage) {
            showMessage("发布配置已保存");
        }
        return true;
    };

    const resetSourceForm = () => {
        const idInput = readInput<HTMLInputElement>("#bazaarSourceID");
        const nameInput = readInput<HTMLInputElement>("#bazaarSourceName");
        const urlInput = readInput<HTMLInputElement>("#bazaarSourceURL");
        const tokenInput = readInput<HTMLInputElement>("#bazaarSourceToken");
        const enabledInput = readInput<HTMLInputElement>("#bazaarSourceEnabled");
        const allowInstallInput = readInput<HTMLInputElement>("#bazaarSourceAllowInstall");
        const openInTabInput = readInput<HTMLInputElement>("#bazaarSourceOpenInTab");
        if (!idInput || !nameInput || !urlInput || !tokenInput || !enabledInput || !allowInstallInput || !openInTabInput) {
            return;
        }
        idInput.value = "";
        nameInput.value = "";
        urlInput.value = "";
        tokenInput.value = "";
        enabledInput.checked = true;
        allowInstallInput.checked = true;
        openInTabInput.checked = true;
    };

    const fillSourceForm = (source: Config.IBazaarSource) => {
        const idInput = readInput<HTMLInputElement>("#bazaarSourceID");
        const nameInput = readInput<HTMLInputElement>("#bazaarSourceName");
        const urlInput = readInput<HTMLInputElement>("#bazaarSourceURL");
        const tokenInput = readInput<HTMLInputElement>("#bazaarSourceToken");
        const enabledInput = readInput<HTMLInputElement>("#bazaarSourceEnabled");
        const allowInstallInput = readInput<HTMLInputElement>("#bazaarSourceAllowInstall");
        const openInTabInput = readInput<HTMLInputElement>("#bazaarSourceOpenInTab");
        if (!idInput || !nameInput || !urlInput || !tokenInput || !enabledInput || !allowInstallInput || !openInTabInput) {
            return;
        }
        idInput.value = source.id;
        nameInput.value = source.name || "";
        urlInput.value = source.url || "";
        tokenInput.value = source.token || "";
        enabledInput.checked = !!source.enabled;
        allowInstallInput.checked = !!source.allowInstall;
        openInTabInput.checked = !!source.openInTab;
    };

    container.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (!target) {
            return;
        }
        const actionElement = target.closest<HTMLElement>("[data-type]");
        const type = actionElement?.getAttribute("data-type");
        if (!type) {
            return;
        }

        if (type === "refresh-publish") {
            void loadAll();
            return;
        }
        if (type === "open-hub") {
            void openBazaarHubTab({ app: model.app });
            return;
        }
        if (type === "open-local-source-page") {
            void openLocalBazaarSourceTab({ app: model.app });
            return;
        }
        if (type === "save-config" && state.bundle) {
            void syncPublishConfigFromForm(true).then((saved) => {
                if (!saved) {
                    return;
                }
                return loadAll();
            }).catch((error) => {
                showMessage((error as Error).message);
            });
            return;
        }
        if (type === "save-source") {
            const idInput = readInput<HTMLInputElement>("#bazaarSourceID");
            const nameInput = readInput<HTMLInputElement>("#bazaarSourceName");
            const urlInput = readInput<HTMLInputElement>("#bazaarSourceURL");
            const tokenInput = readInput<HTMLInputElement>("#bazaarSourceToken");
            const enabledInput = readInput<HTMLInputElement>("#bazaarSourceEnabled");
            const allowInstallInput = readInput<HTMLInputElement>("#bazaarSourceAllowInstall");
            const openInTabInput = readInput<HTMLInputElement>("#bazaarSourceOpenInTab");
            if (!idInput || !nameInput || !urlInput || !tokenInput || !enabledInput || !allowInstallInput || !openInTabInput) {
                return;
            }

            void upsertBazaarSource({
                id: idInput.value.trim(),
                name: nameInput.value.trim(),
                url: urlInput.value.trim(),
                token: tokenInput.value.trim(),
                enabled: enabledInput.checked,
                allowInstall: allowInstallInput.checked,
                openInTab: openInTabInput.checked,
            }).then(() => {
                showMessage("集市源已保存");
                resetSourceForm();
                return loadAll();
            }).catch((error) => {
                showMessage((error as Error).message);
            });
            return;
        }
        if (type === "reset-source") {
            resetSourceForm();
            return;
        }
        if (type === "edit-source" && state.bundle) {
            const sourceID = readSourceID(event);
            const source = findSourceByID(state.bundle, sourceID);
            if (!source) {
                return;
            }
            fillSourceForm(source);
            return;
        }
        if (type === "test-source" && state.bundle) {
            const sourceID = readSourceID(event);
            const source = findSourceByID(state.bundle, sourceID);
            if (!source) {
                return;
            }
            void testBazaarSource({ sourceID: source.id }).then((count) => {
                showMessage(`源测试通过，可访问 ${count} 个包`);
            }).catch((error) => {
                showMessage((error as Error).message);
            });
            return;
        }
        if (type === "open-source-tab" && state.bundle) {
            const sourceID = readSourceID(event);
            const source = findSourceByID(state.bundle, sourceID);
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
            return;
        }
        if (type === "browse-source") {
            const sourceID = readSourceID(event);
            if (!sourceID) {
                return;
            }
            void openBazaarHubTab({
                app: model.app,
                sourceID,
            });
            return;
        }
        if (type === "remove-source") {
            const sourceID = readSourceID(event);
            if (!sourceID) {
                return;
            }
            confirmDialog("⚠️ 移除第三方源", `确认移除源 ${sourceID} 吗？`, () => {
                void removeBazaarSource(sourceID).then(() => {
                    showMessage("已移除第三方源");
                    return loadAll();
                }).catch((error) => {
                    showMessage((error as Error).message);
                });
            });
            return;
        }
        if (type === "publish-package") {
            const packageElement = actionElement;
            if (!packageElement) {
                return;
            }
            const packageType = packageElement.getAttribute("data-package-type") || "";
            const packageName = packageElement.getAttribute("data-package-name") || "";
            if (!packageType || !packageName) {
                return;
            }
            if (!readInput<HTMLInputElement>("#bazaarPublishEnabled")?.checked) {
                showMessage("请先启用“启用发布”并保存配置");
                return;
            }
            packageElement.setAttribute("disabled", "disabled");
            void (async () => {
                const saved = await syncPublishConfigFromForm(false);
                if (!saved) {
                    return;
                }
                const result = await publishBazaarPackage(packageType, packageName);
                if (result.warning) {
                    showMessage(result.warning);
                } else {
                    showMessage(`已发布 ${packageName} v${result.record.version}`);
                }
                await loadAll();
            })().catch((error) => {
                showMessage((error as Error).message);
            }).finally(() => {
                packageElement.removeAttribute("disabled");
            });
        }
    });

    void loadAll();
}
