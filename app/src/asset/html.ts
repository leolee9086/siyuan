/** 判断路径是否指向 HTML/HTM 文件；用于资源菜单和 iframe 输入校验。 */
/** @同步豁免: 性能考虑 */
export const isHTMLFilePath = (value: string) => {
    const path = (value.split(/[?#]/, 1)[0] ?? "").toLowerCase();
    return path.endsWith(".html") || path.endsWith(".htm");
};

/** 判断路径是否为本地 assets 下的 HTML 文件；仅此范围自动追加 iframe 参数。 */
/** @同步豁免: 性能考虑 */
export const isLocalHTMLAssetPath = (value: string) => {
    const path = value.split(/[?#]/, 1)[0] ?? "";
    const normalizedPath = path.startsWith("./") ? path.substring(2) : path;
    return (normalizedPath.startsWith("assets/") || normalizedPath.startsWith("/assets/")) &&
        isHTMLFilePath(normalizedPath);
};

/** 规范化本地 HTML iframe URL；保留远程/非 HTML 地址及原有查询和锚点。 */
/** @同步豁免: 性能考虑 */
export const getHTMLAssetIFrameSrc = (assetPath: string) => {
    if (!isLocalHTMLAssetPath(assetPath)) {
        return assetPath;
    }
    const hashIndex = assetPath.indexOf("#");
    const hash = hashIndex > -1 ? assetPath.substring(hashIndex) : "";
    const pathAndQuery = hashIndex > -1 ? assetPath.substring(0, hashIndex) : assetPath;
    const queryIndex = pathAndQuery.indexOf("?");
    const path = queryIndex > -1 ? pathAndQuery.substring(0, queryIndex) : pathAndQuery;
    const params = new URLSearchParams(queryIndex > -1 ? pathAndQuery.substring(queryIndex + 1) : "");
    params.set("iframe", "true");
    return `${path}?${params.toString()}${hash}`;
};

/** 规范化容器内 iframe 的本地 HTML 地址，并报告 DOM 是否发生变化。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const normalizeHTMLAssetIFrameSources = (root: ParentNode) => {
    let changed = false;
    for (const item of root.querySelectorAll<HTMLIFrameElement>('[data-type="NodeIFrame"] iframe')) {
        const src = item.getAttribute("src");
        if (!src) {
            continue;
        }
        const normalizedSrc = getHTMLAssetIFrameSrc(src);
        if (normalizedSrc === src) {
            continue;
        }
        item.setAttribute("src", normalizedSrc);
        changed = true;
    }
    return changed;
};

/** 规范化 HTML iframe 块字符串；无目标节点时原样返回以避免无谓重渲染。 */
/** @同步豁免: 性能考虑 */
export const normalizeHTMLAssetIFrameBlockDOM = (html: string) => {
    if (!html.includes("NodeIFrame") || !html.includes("<iframe")) {
        return html;
    }
    const template = document.createElement("template");
    template.innerHTML = html;
    if (!normalizeHTMLAssetIFrameSources(template.content)) {
        return html;
    }
    return template.innerHTML;
};
