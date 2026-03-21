import "./style.scss";

interface IBazaarPublishedItem {
    packageType: string;
    packageName: string;
    version: string;
    artifactId: string;
    publishedAt: number;
    displayName: string;
    description: string;
    author: string;
    officialName: boolean;
    downloadPath: string;
}

interface IBazaarPublishedIndex {
    updatedAt: number;
    packages: IBazaarPublishedItem[];
}

interface IBazaarResponse<T = unknown> {
    code: number;
    msg?: string;
    error?: string;
    data?: T;
}

const TYPE_LABEL: Record<string, string> = {
    plugins: "插件",
    widgets: "挂件",
    themes: "主题",
    icons: "图标",
    templates: "模板",
};

const API_PUBLIC_INDEX = "/api/s-forge/bazaar/public/index";
const API_PUBLIC_AUTH = "/api/s-forge/bazaar/public/auth";

const mountElement = document.getElementById("bazaar-source-root");

const stripLegacyTokenQuery = () => {
    const currentURL = new URL(window.location.href);
    const hasToken = currentURL.searchParams.has("token") || currentURL.searchParams.has("bazaarToken");
    if (!hasToken) {
        return;
    }
    currentURL.searchParams.delete("token");
    currentURL.searchParams.delete("bazaarToken");
    window.history.replaceState({}, "", `${currentURL.pathname}${currentURL.search}${currentURL.hash}`);
};

const escapeHTML = (text: string): string => {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
};

const formatDateTime = (timestamp: number): string => {
    if (!timestamp) {
        return "-";
    }
    return new Date(timestamp).toLocaleString();
};

const parseJSONResponse = async <T = unknown>(response: Response): Promise<T | null> => {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
};

const isAuthRequired = (response: Response, body: IBazaarResponse | null): boolean => {
    if (response.status === 401) {
        return true;
    }
    return body?.error === "bazaar_publish_auth_required";
};

const loginBazaarSource = async (token: string): Promise<void> => {
    const response = await fetch(API_PUBLIC_AUTH, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
    });
    const body = await parseJSONResponse<IBazaarResponse>(response);
    if (!response.ok || !body || body.code !== 0) {
        throw new Error(body?.msg || `鉴权失败 (${response.status})`);
    }
};

const requestPublishedPackages = async (): Promise<{
    authRequired: boolean;
    data?: IBazaarPublishedIndex;
    message?: string;
}> => {
    const response = await fetch(API_PUBLIC_INDEX, {
        method: "GET",
        credentials: "same-origin",
    });
    const body = await parseJSONResponse<IBazaarResponse<IBazaarPublishedIndex>>(response);
    if (isAuthRequired(response, body)) {
        return {
            authRequired: true,
            message: body?.msg || "该集市源需要鉴权",
        };
    }
    if (!response.ok || !body || body.code !== 0 || !body.data) {
        return {
            authRequired: false,
            message: body?.msg || `请求失败 (${response.status})`,
        };
    }
    return {
        authRequired: false,
        data: body.data,
    };
};

const renderLoading = () => {
    if (!mountElement) {
        return;
    }
    mountElement.innerHTML = `<div class="bazaar-source"><div class="bazaar-source__empty">正在读取已发布包...</div></div>`;
};

const renderError = (message: string) => {
    if (!mountElement) {
        return;
    }
    mountElement.innerHTML = `<div class="bazaar-source"><div class="bazaar-source__empty">${escapeHTML(message)}</div></div>`;
};

const renderAuthLogin = (message: string) => {
    if (!mountElement) {
        return;
    }
    mountElement.innerHTML = `<main class="bazaar-source">
    <section class="bazaar-source__auth">
        <h1 class="bazaar-source__auth-title">集市源鉴权</h1>
        <div class="bazaar-source__auth-sub">${escapeHTML(message || "请输入访问令牌以浏览已发布包")}</div>
        <form id="bazaarSourceLoginForm" class="bazaar-source__auth-form">
            <input id="bazaarSourceTokenInput" class="bazaar-source__auth-input" type="password" autocomplete="off" placeholder="输入工作空间 API token 或发布 token">
            <button id="bazaarSourceLoginBtn" class="bazaar-source__auth-btn" type="submit">登录集市源</button>
        </form>
        <div id="bazaarSourceLoginError" class="bazaar-source__auth-error"></div>
    </section>
</main>`;

    const form = document.getElementById("bazaarSourceLoginForm") as HTMLFormElement | null;
    const tokenInput = document.getElementById("bazaarSourceTokenInput") as HTMLInputElement | null;
    const submitButton = document.getElementById("bazaarSourceLoginBtn") as HTMLButtonElement | null;
    const errorElement = document.getElementById("bazaarSourceLoginError") as HTMLDivElement | null;

    form?.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!tokenInput || !submitButton || !errorElement) {
            return;
        }
        const token = (tokenInput.value || "").trim();
        if (!token) {
            errorElement.textContent = "请输入有效 token";
            return;
        }

        submitButton.disabled = true;
        errorElement.textContent = "";

        void loginBazaarSource(token).then(() => {
            tokenInput.value = "";
            void loadPublishedPackages();
        }).catch((error) => {
            errorElement.textContent = error instanceof Error ? error.message : String(error);
        }).finally(() => {
            submitButton.disabled = false;
        });
    });
};

const renderPage = (index: IBazaarPublishedIndex) => {
    if (!mountElement) {
        return;
    }
    const cards = index.packages || [];
    const cardHTML = cards.map((pkg) => {
        const packageTypeLabel = TYPE_LABEL[pkg.packageType] || pkg.packageType;
        const searchText = `${pkg.packageType} ${pkg.packageName} ${pkg.displayName} ${pkg.description} ${pkg.author} ${pkg.version}`.toLowerCase();
        const downloadPath = pkg.downloadPath || `/api/s-forge/bazaar/public/download/${pkg.artifactId}`;
        return `<article class="bazaar-source__card" data-search="${escapeHTML(searchText)}">
    <h3 class="bazaar-source__card-title">${escapeHTML(pkg.displayName || pkg.packageName)}</h3>
    <div class="bazaar-source__pkg">${escapeHTML(packageTypeLabel)} · ${escapeHTML(pkg.packageName)} · v${escapeHTML(pkg.version || "-")}</div>
    <div class="bazaar-source__desc">${escapeHTML(pkg.description || "暂无描述")}</div>
    <div class="bazaar-source__tags">
        <span class="bazaar-source__tag">作者 ${escapeHTML(pkg.author || "-")}</span>
        ${pkg.officialName ? '<span class="bazaar-source__tag">与官方重名</span>' : ""}
    </div>
    <div class="bazaar-source__foot">
        <span>发布时间 ${escapeHTML(formatDateTime(pkg.publishedAt))}</span>
        <a class="bazaar-source__download" href="${escapeHTML(downloadPath)}">下载</a>
    </div>
</article>`;
    }).join("");

    mountElement.innerHTML = `<main class="bazaar-source">
    <header class="bazaar-source__header">
        <div>
            <div class="bazaar-source__title">思源集市源</div>
            <div class="bazaar-source__sub">公开索引更新时间：${escapeHTML(formatDateTime(index.updatedAt))}</div>
        </div>
        <input id="bazaarSourceKeyword" class="bazaar-source__search" placeholder="筛选包名 / 作者 / 类型">
    </header>
    <section class="bazaar-source__meta">
        <div>JSON 索引：<a href="${escapeHTML(API_PUBLIC_INDEX)}">${escapeHTML(API_PUBLIC_INDEX)}</a></div>
        <div>包总数：${cards.length}</div>
    </section>
    <section id="bazaarSourceGrid" class="bazaar-source__grid">
        ${cards.length ? cardHTML : '<div class="bazaar-source__empty">暂无已发布包</div>'}
    </section>
</main>`;

    const searchInput = document.getElementById("bazaarSourceKeyword") as HTMLInputElement | null;
    const cardElements = Array.from(document.querySelectorAll<HTMLElement>(".bazaar-source__card"));
    searchInput?.addEventListener("input", () => {
        const keyword = (searchInput.value || "").trim().toLowerCase();
        for (const cardElement of cardElements) {
            const search = cardElement.getAttribute("data-search") || "";
            cardElement.style.display = !keyword || search.includes(keyword) ? "" : "none";
        }
    });
};

const loadPublishedPackages = async () => {
    renderLoading();
    try {
        const result = await requestPublishedPackages();
        if (result.authRequired) {
            renderAuthLogin(result.message || "该集市源需要鉴权");
            return;
        }
        if (!result.data) {
            throw new Error(result.message || "加载失败");
        }
        renderPage(result.data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        renderError(`加载失败：${message}`);
    }
};

stripLegacyTokenQuery();
void loadPublishedPackages();
