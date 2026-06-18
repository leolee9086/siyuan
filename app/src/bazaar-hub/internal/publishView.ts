/** 用途：HTML 属性转义能力。使用范围：publish 字符串模板属性值。解耦评估：安全工具依赖，通过内部网关导入降低路径耦合。 */
import { escapeAttr } from "./imports";

/** 用途：HTML 文本转义能力。使用范围：publish 字符串模板文本内容。解耦评估：安全工具依赖，通过内部网关导入降低路径耦合。 */
import { escapeHtml } from "./imports";

/** 用途：安全统计类型定义。使用范围：publish 安全统计渲染。 */
import type { IBazaarSecurityStats } from "./imports";

/** 用途：工作空间类型定义。使用范围：publish 页面渲染。 */
import type { IBazaarWorkspaceBundle } from "./imports";

/** 用途：格式化时间。意图：统一发布时间与最近请求时间显示。调用时机：渲染表格。问题/改进：当前使用浏览器本地格式。 */
const formatDateTime = (timestamp: number) => {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
};

/** 用途：包类型映射标签。意图：提升表格可读性。调用时机：渲染已安装包与发布记录。问题/改进：新增类型需补充映射。 */
const packageTypeLabel = (packageType: string) => {
    const labelMap: Record<string, string> = {
        plugins: "插件",
        widgets: "挂件",
        themes: "主题",
        icons: "图标",
        templates: "模板",
    };
    return labelMap[packageType] || packageType;
};

/** 用途：渲染默认源下拉选项。意图：同步默认源配置。调用时机：页面渲染。问题/改进：当前按 sources 顺序输出。 */
const renderSourceOptions = (bundle: IBazaarWorkspaceBundle) => {
    let optionsHTML = "<option value=\"\">(自动)</option>";
    for (const source of bundle.workspace.sources) {
        const selected = source.id === bundle.workspace.hub.defaultSourceID ? " selected" : "";
        optionsHTML += `<option value="${escapeAttr(source.id)}"${selected}>${escapeHtml(source.name || source.url)}</option>`;
    }
    return optionsHTML;
};

/** 用途：渲染源管理表格行。意图：集中管理源状态与操作按钮。调用时机：页面渲染。问题/改进：当前为字符串模板拼接。 */
const renderSourceRows = (bundle: IBazaarWorkspaceBundle) => {
    if (!bundle.workspace.sources.length) {
        return "<tr><td colspan=\"4\" class=\"bazaar-publish__empty-cell\">暂无第三方源</td></tr>";
    }

    let rowsHTML = "";
    for (const source of bundle.workspace.sources) {
        const enabledClass = source.enabled ? "b3-chip--primary" : "";
        const installClass = source.allowInstall ? "b3-chip--primary" : "";
        rowsHTML += `<tr>
    <td><div class="bazaar-publish__source-name">${escapeHtml(source.name || source.url)}</div><div class="bazaar-publish__source-url">${escapeHtml(source.url)}</div></td>
    <td><span class="b3-chip ${enabledClass}">${source.enabled ? "启用" : "禁用"}</span><span class="b3-chip ${installClass}">${source.allowInstall ? "可安装" : "仅浏览"}</span></td>
    <td>${formatDateTime(source.updatedAt || source.createdAt)}</td>
    <td class="bazaar-publish__row-actions">
        <button class="b3-button b3-button--small b3-button--outline" data-type="edit-source" data-source-id="${escapeAttr(source.id)}">编辑</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="test-source" data-source-id="${escapeAttr(source.id)}">测试</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="open-source-tab" data-source-id="${escapeAttr(source.id)}">打开 Tab</button>
        <button class="b3-button b3-button--small b3-button--outline" data-type="browse-source" data-source-id="${escapeAttr(source.id)}">浏览包</button>
        <button class="b3-button b3-button--small b3-button--cancel" data-type="remove-source" data-source-id="${escapeAttr(source.id)}">移除</button>
    </td>
</tr>`;
    }
    return rowsHTML;
};

/** 用途：渲染可发布包表格行。意图：集中处理 installed 结构遍历。调用时机：页面渲染。问题/改进：当前按对象遍历顺序展示。 */
const renderInstalledRows = (bundle: IBazaarWorkspaceBundle) => {
    let rowsHTML = "";
    for (const [packageType, list] of Object.entries(bundle.workspace.installed || {})) {
        for (const item of list || []) {
            rowsHTML += `<tr>
    <td>${packageTypeLabel(packageType)}</td>
    <td><div class="bazaar-publish__source-name">${escapeHtml(item.preferredName || item.name)}</div><div class="bazaar-publish__source-url">${escapeHtml(item.name)}</div></td>
    <td>v${escapeHtml(item.version || "-")}</td>
    <td>${escapeHtml(item.author || "-")}</td>
    <td><button class="b3-button b3-button--small" data-type="publish-package" data-package-type="${escapeAttr(packageType)}" data-package-name="${escapeAttr(item.name)}">发布</button></td>
</tr>`;
        }
    }
    if (!rowsHTML) {
        return "<tr><td colspan=\"5\" class=\"bazaar-publish__empty-cell\">当前工作空间暂无已安装包</td></tr>";
    }
    return rowsHTML;
};

/** 用途：渲染发布记录表格行。意图：统一发布记录输出。调用时机：页面渲染。问题/改进：当前为全量记录展示。 */
const renderPublishedRows = (bundle: IBazaarWorkspaceBundle) => {
    const packages = bundle.published.packages || [];
    if (!packages.length) {
        return "<tr><td colspan=\"5\" class=\"bazaar-publish__empty-cell\">暂无发布记录</td></tr>";
    }

    let rowsHTML = "";
    for (const item of packages) {
        const warning = item.officialName ? "<span class=\"b3-chip b3-chip--warning\">与官方重名</span>" : "-";
        rowsHTML += `<tr>
    <td>${packageTypeLabel(item.packageType)}</td>
    <td>${escapeHtml(item.displayName || item.packageName)}</td>
    <td>v${escapeHtml(item.version || "-")}</td>
    <td>${formatDateTime(item.publishedAt)}</td>
    <td>${warning}</td>
</tr>`;
    }
    return rowsHTML;
};

/** 用途：渲染安全统计区域。意图：统一统计头和客户端列表输出。调用时机：页面渲染。问题/改进：当前为快照展示。 */
const renderSecurityStats = (stats: IBazaarSecurityStats | null) => {
    if (!stats) {
        return "<div class=\"bazaar-publish__muted\">暂无统计数据</div>";
    }

    let clientRowsHTML = "";
    for (const item of stats.clients || []) {
        clientRowsHTML += `<tr><td>${escapeHtml(item.ip)}</td><td>${item.accepted}</td><td>${item.rejected}</td><td>${formatDateTime(item.lastSeen)}</td></tr>`;
    }
    if (!clientRowsHTML) {
        clientRowsHTML = "<tr><td colspan=\"4\" class=\"bazaar-publish__empty-cell\">暂无客户端请求记录</td></tr>";
    }

    return `<div class="bazaar-publish__stats-head"><span>通过请求：<strong>${stats.totalAccepted}</strong></span><span>拒绝请求：<strong>${stats.totalRejected}</strong></span></div>
<table class="b3-table"><thead><tr><th>IP</th><th>通过</th><th>拒绝</th><th>最近请求</th></tr></thead><tbody>${clientRowsHTML}</tbody></table>`;
};

/** 用途：构建 publish 页面 HTML。意图：把渲染模板集中在视图模块。调用时机：bundle 可用时渲染。问题/改进：当前仍是整页字符串模板。 */
const buildPublishHTML = (bundle: IBazaarWorkspaceBundle, stats: IBazaarSecurityStats | null) => {
    const publish = bundle.workspace.publish;
    const security = bundle.workspace.security;
    const hub = bundle.workspace.hub;

    return `<div class="bazaar-publish__layout">
    <header class="bazaar-publish__header"><div class="bazaar-publish__title">集市发布设置</div><div class="bazaar-publish__header-actions">
        <button class="b3-button b3-button--outline" data-type="open-hub">打开集市广场</button>
        <button class="b3-button b3-button--outline" data-type="open-local-source-page">打开集市源页面</button>
        <button class="b3-button b3-button--outline" data-type="refresh-publish">刷新</button></div></header>
    <section class="bazaar-publish__section"><h3>发布与鉴权</h3><div class="bazaar-publish__grid">
        <label class="b3-label b3-label--inner"><span>启用发布</span><input id="bazaarPublishEnabled" class="b3-switch" type="checkbox"${publish.enabled ? " checked" : ""}></label>
        <label class="b3-label b3-label--inner"><span>公开接口需要鉴权</span><input id="bazaarPublishRequireAuth" class="b3-switch" type="checkbox"${publish.requireAuth ? " checked" : ""}></label>
        <label class="b3-label b3-label--inner"><span>最小暴露模式</span><input id="bazaarPublishMinExpose" class="b3-switch" type="checkbox"${publish.minExpose ? " checked" : ""}></label>
        <label class="b3-label b3-label--inner"><span>允许与官方同名</span><input id="bazaarPublishAllowCollision" class="b3-switch" type="checkbox"${publish.allowOfficialNameCollision ? " checked" : ""}></label>
    </div><div class="bazaar-publish__field"><div class="bazaar-publish__field-label">发布令牌（X-Bazaar-Token / Bearer）</div>
        <input id="bazaarPublishAuthToken" class="b3-text-field fn__block" type="password" autocomplete="new-password" value="${escapeAttr(publish.authToken || "")}" placeholder="留空表示仅允许工作空间 API token / MAGI 身份令牌"></div></section>
    <section class="bazaar-publish__section"><h3>安全防护（限流）</h3><div class="bazaar-publish__grid">
        <label class="b3-label b3-label--inner"><span>启用限流</span><input id="bazaarSecurityEnableRateLimit" class="b3-switch" type="checkbox"${security.enableRateLimit ? " checked" : ""}></label>
        <label class="b3-label b3-label--inner"><span>每分钟请求数</span><input id="bazaarSecurityRPM" class="b3-text-field" type="number" min="1" value="${security.requestsPerMinute}"></label>
        <label class="b3-label b3-label--inner"><span>Burst</span><input id="bazaarSecurityBurst" class="b3-text-field" type="number" min="1" value="${security.burst}"></label>
        <label class="b3-label b3-label--inner"><span>窗口秒数</span><input id="bazaarSecurityWindowSeconds" class="b3-text-field" type="number" min="1" value="${security.windowSeconds}"></label>
    </div><div class="bazaar-publish__stats">${renderSecurityStats(stats)}</div></section>
    <section class="bazaar-publish__section"><h3>广场偏好</h3><div class="bazaar-publish__grid">
        <label class="b3-label b3-label--inner"><span>显示官方入口</span><input id="bazaarHubShowOfficial" class="b3-switch" type="checkbox"${hub.showOfficial ? " checked" : ""}></label>
        <label class="b3-label b3-label--inner"><span>默认第三方源</span><select id="bazaarHubDefaultSource" class="b3-select">${renderSourceOptions(bundle)}</select></label>
    </div></section>
    <section class="bazaar-publish__section"><button class="b3-button" data-type="save-config">保存发布配置</button></section>
    <section class="bazaar-publish__section"><h3>第三方集市源管理</h3><div class="bazaar-publish__source-form">
        <input id="bazaarSourceID" class="fn__none"><input id="bazaarSourceName" class="b3-text-field" placeholder="名称（可空）"><input id="bazaarSourceURL" class="b3-text-field" placeholder="URL，例如 https://example.com">
        <input id="bazaarSourceToken" class="b3-text-field" type="password" autocomplete="new-password" placeholder="可选令牌"><label class="b3-label b3-label--inner"><span>启用</span><input id="bazaarSourceEnabled" class="b3-switch" type="checkbox" checked></label>
        <label class="b3-label b3-label--inner"><span>允许安装</span><input id="bazaarSourceAllowInstall" class="b3-switch" type="checkbox" checked></label><label class="b3-label b3-label--inner"><span>允许在 Tab 中打开</span><input id="bazaarSourceOpenInTab" class="b3-switch" type="checkbox" checked></label>
        <button class="b3-button" data-type="save-source">保存源</button><button class="b3-button b3-button--outline" data-type="reset-source">清空</button></div>
        <table class="b3-table"><thead><tr><th>源</th><th>能力</th><th>更新时间</th><th>操作</th></tr></thead><tbody>${renderSourceRows(bundle)}</tbody></table></section>
    <section class="bazaar-publish__section"><h3>当前工作空间可发布包</h3><table class="b3-table"><thead><tr><th>类型</th><th>包名</th><th>版本</th><th>作者</th><th>操作</th></tr></thead><tbody>${renderInstalledRows(bundle)}</tbody></table></section>
    <section class="bazaar-publish__section"><h3>发布记录</h3><table class="b3-table"><thead><tr><th>类型</th><th>名称</th><th>版本</th><th>发布时间</th><th>提示</th></tr></thead><tbody>${renderPublishedRows(bundle)}</tbody></table></section>
</div>`;
};

/** 用途：渲染加载态。意图：加载中占位。调用时机：loadAll 开始。问题/改进：当前为简单文本。 */
/** 导出 renderLoading 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const renderLoading = (container: HTMLElement) => {
    container.innerHTML = "<div class=\"bazaar-publish__loading\">正在加载发布配置...</div>";
};

/** 用途：渲染 publish 页面。意图：统一加载态和正常态切换。调用时机：loadAll 完成。问题/改进：当前整页重绘。 */
/** 导出 renderPublishPage 供 publish 控制器复用 */
/** @同步豁免: UI构建 */
export const renderPublishPage = (container: HTMLElement, state: { bundle: IBazaarWorkspaceBundle | null; stats: IBazaarSecurityStats | null }) => {
    if (!state.bundle) {
        renderLoading(container);
        return;
    }
    container.innerHTML = buildPublishHTML(state.bundle, state.stats);
};
