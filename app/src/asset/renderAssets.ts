import { Constants } from "../constants";
import { getAllModels } from "../layout/getAll";
import { isMobile } from "../platform";
import {pathPosix} from "../util/file/path/operations";
import * as dayjs from "dayjs";
import {resolveAssetURL} from "./assetUrl";
import {getAssetFormat} from "./assetFormat";
import {escapeAttr} from "../util/DOM/escape";
import {getHTMLAssetIFrameSrc, isHTMLFilePath} from "./html";
import {isBrowserRenderableImagePath} from "../util/imageURL";
import {getAssetsPreviewPath} from "./previewPath";

/**
 * 作用：为旧资源菜单生成和主 Asset/文件浏览器相同的缩略图地址。
 * 意图：资源菜单也必须绕过静态构建目录，避免 `/stage/build/.../api` 被当成应用壳。
 * 调用时机：悬停预览图片或非图片文件时。
 */
const getPreviewThumbnailURL = (pathString: string, size: number) =>
    resolveAssetURL(`/api/s-forge/thumbnail?path=${encodeURIComponent(pathString)}&size=${size}`);

let previewImageErrorHandlerInstalled = false;

function ensurePreviewImageErrorHandler() {
    if (previewImageErrorHandlerInstalled || typeof document === "undefined") {
        return;
    }
    document.addEventListener("error", event => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement) || !target.hasAttribute("data-sforge-preview-image")) {
            return;
        }
        const error = document.createElement("span");
        error.setAttribute("role", "alert");
        error.style.color = "var(--b3-theme-error)";
        error.textContent = target.getAttribute("data-sforge-preview-image") === "thumbnail"
            ? "缩略图加载失败"
            : "资源预览加载失败";
        target.replaceWith(error);
    }, true);
    previewImageErrorHandlerInstalled = true;
}

/**
 * 渲染资源预览 HTML
 * 
 * 作用：根据资源路径生成对应的预览 HTML
 *   - 图片：使用缩略图 API
 *   - 音频/视频：使用原生播放器
 *   - 文本文件：显示文件内容预览
 *   - 其他文件：请求格式 Provider 的缩略图；Provider 失败时由统一错误监听显式呈现
 * 
 * 意图：在资源选择菜单、历史记录等场景中提供资源预览
 * 调用时机：当用户悬停或选择资源列表项时
 * 
 * @param pathString - 资源的相对路径（如 "assets/image.png"）
 * @param dataPath - 可选数据路径；提供时追加到媒体地址，供内核在历史快照等场景定位资源
 * @returns 预览的 HTML 字符串，如果路径为空则返回空字符串
 */
export const renderAssetsPreview = (pathString: string, dataPath?: string) => {
    if (!pathString) {
        return "";
    }
    ensurePreviewImageErrorHandler();
    const format = getAssetFormat(pathString);
    // 媒体地址统一经安全转义；携带 dataPath 时由 getAssetsPreviewPath 追加查询参数，供历史快照等场景透传给内核。
    const previewPath = escapeAttr(getAssetsPreviewPath(pathString, dataPath));

    // 图片：使用缩略图 API + 元信息面板
    if (format.previewKind === "image") {
        // 本地缩略图接口按原始路径检索文件；dataPath 作为附加查询参数透传，由内核侧自行取舍。
        const thumbnailUrl = getPreviewThumbnailURL(pathString, 360)
            + (dataPath ? `&dataPath=${encodeURIComponent(dataPath)}` : "");
        // 生成唯一 ID 用于后续填充元信息
        const metaId = `asset-meta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 异步加载元信息
        loadAssetMetaPreview(pathString, metaId);

        return `<div style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; overflow: auto;">
            <img style="max-height: 200px; max-width: 100%; object-fit: contain;" src="${thumbnailUrl}" data-original="${pathString}" data-sforge-preview-image="thumbnail" alt="${escapeHtml(pathPosix().basename(pathString))}">
            <div id="${metaId}" style="width: 100%; margin-top: 8px; font-size: 12px;"></div>
        </div>`;
    }

    // 音频：使用原生播放器
    if (format.previewKind === "audio") {
        return `<audio style="max-width: 100%" controls="controls" src="${previewPath}"></audio>`;
    }

    // 视频：使用原生播放器
    if (format.previewKind === "video") {
        return `<video style="max-width: 100%" controls="controls" src="${previewPath}"></video>`;
    }

    // 文本文件：显示异步加载占位符，然后加载内容
    if (format.previewKind === "text") {
        // 生成唯一 ID 用于后续内容填充
        const previewId = `text-preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 异步加载文本内容
        loadTextPreview(pathString, previewId);

        return `<div id="${previewId}" class="fn__flex-column" style="width: 100%; height: 100%; overflow: auto; padding: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; background: var(--b3-theme-surface); border-radius: 4px;">
            <div class="fn__loading" style="height: 100%;"></div>
        </div>`;
    }

    // 其他文件：只请求格式 Provider 生成的缩略图，不把文件图标伪装成资源缩略图
    const thumbnailUrl = getPreviewThumbnailURL(pathString, 256)
        + (dataPath ? `&dataPath=${encodeURIComponent(dataPath)}` : "");
    return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <img style="max-width: 128px; max-height: 128px;" src="${thumbnailUrl}" data-sforge-preview-image="thumbnail" alt="${escapeHtml(pathPosix().basename(pathString))}">
        <div style="margin-top: 8px; color: var(--b3-theme-on-surface); font-size: 12px; word-break: break-all; text-align: center; max-width: 100%;">
            ${escapeHtml(pathPosix().basename(pathString))}
        </div>
    </div>`;
};

/** 将 RGB 转换为十六进制 */
const rgbToHexStr = (r: number, g: number, b: number) =>
    `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

/** 渲染单个色块 HTML */
const renderPaletteBlock = (p: { color: [number, number, number]; ratio: number }) => {
    const [r, g, b] = p.color;
    const hex = rgbToHexStr(r, g, b);
    // 悬浮提示：有占比则显示百分比，否则只显示色值
    const title = p.ratio > 0 ? `${hex} (${(p.ratio * 100).toFixed(1)}%)` : hex;
    return `<div title="${title}" style="width: 20px; height: 20px; background: ${hex}; border-radius: 4px; cursor: pointer; border: 1px solid var(--b3-border-color);" data-color="${hex}"></div>`;
};

/** 处理色块点击复制 */
const handlePaletteClick = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const color = target.getAttribute("data-color");
    if (color) {
        navigator.clipboard.writeText(color).catch(() => { });
    }
};

/** 格式化文件大小 */
const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** 渲染星级 */
const renderStars = (star: number) => {
    const filled = "★".repeat(star);
    const empty = "☆".repeat(5 - star);
    return `<span style="color: var(--b3-theme-primary);">${filled}</span><span style="opacity: 0.3;">${empty}</span>`;
};

/** 渲染标签 */
const renderTags = (tags: string[]) => {
    return tags.map(t => `<span style="background: var(--b3-theme-primary-light); color: var(--b3-theme-primary); padding: 1px 6px; border-radius: 3px; margin-right: 4px; margin-bottom: 4px;">${escapeHtml(t)}</span>`).join("");
};

/** 获取素材元数据 */
const fetchAssetMeta = async (path: string) => {
    const response = await fetch("/api/s-forge/asset-meta/get", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
    });
    return await response.json();
};

/** 确保获取完整的素材元数据（如果缺失则尝试修复） */
const ensureAssetMeta = async (path: string) => {
    // 1. 获取现有元数据；不存在时继续走真实提取流程，不构造空对象。
    const getResult = await fetchAssetMeta(path);
    let meta = getResult.code === 0 && getResult.data ? getResult.data : undefined;
    const metaMissing = !meta || meta.width === undefined || meta.fileSize === undefined;
    const palettes = meta?.palettes;

    // 2. 如果数据完整，直接返回
    if (palettes && palettes.length > 0 && !metaMissing) {
        return meta;
    }

    // 3. 调用提取接口进行修复
    const extractResponse = await fetch("/api/s-forge/asset-meta/palette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, colorCount: 8 }),
    });
    const extractResult = await extractResponse.json();
    if (extractResult.code !== 0) {
        throw new Error(extractResult.msg || "素材调色板提取失败");
    }

    // 4. 如果是修复了元数据，重新获取完整信息
    if (metaMissing || !meta?.palettes?.length) {
        const refreshResult = await fetchAssetMeta(path);
        if (refreshResult.code !== 0 || !refreshResult.data) {
            throw new Error(refreshResult.msg || "素材元数据读取失败");
        }
        meta = refreshResult.data;
    }

    if (!meta) {
        throw new Error("素材元数据为空");
    }

    // 使用新提取的调色板（如果 meta 中还没有）
    if (!meta.palettes?.length && extractResult.data?.palettes?.length) {
        meta.palettes = extractResult.data?.palettes;
    }

    return meta;
};

/**
 * 异步加载素材元信息预览
 * 
 * @param path - 素材路径
 * @param elementId - 目标容器元素 ID
 */
const loadAssetMetaPreview = async (path: string, elementId: string) => {
    try {
        const meta = await ensureAssetMeta(path);
        const palettes = meta?.palettes;

        const element = document.getElementById(elementId);
        if (!element) {
            return;
        }

        // 构建元信息 HTML
        const infoRows: string[] = [];

        // 调色板
        const paletteHtml = (palettes && palettes.length > 0)
            ? `<div class="fn__flex" style="gap: 4px; margin-bottom: 8px;">${palettes.map(renderPaletteBlock).join("")}</div>`
            : "<div style=\"color: var(--b3-theme-on-surface-light); opacity: 0.5; margin-bottom: 8px;\">调色板: 提取中...</div>";
        infoRows.push(paletteHtml);

        // 尺寸
        const sizeText = (meta?.width && meta?.height) ? `${meta.width} × ${meta.height}` : "—";
        infoRows.push(`<div style="color: var(--b3-theme-on-surface-light);">尺寸: ${sizeText}</div>`);

        // 文件大小
        const fileSizeText = meta?.fileSize ? formatFileSize(meta.fileSize) : "—";
        infoRows.push(`<div style="color: var(--b3-theme-on-surface-light);">大小: ${fileSizeText}</div>`);

        // 星级
        infoRows.push(`<div>评分: ${renderStars(meta?.star ?? 0)}</div>`);

        // 标签
        const tagsHtml = (meta?.tags && meta.tags.length > 0)
            ? renderTags(meta.tags)
            : "<span style=\"opacity: 0.5;\">无标签</span>";
        infoRows.push(`<div class="fn__flex" style="flex-wrap: wrap; margin-top: 4px;">${tagsHtml}</div>`);

        // 注释
        const annotationText = meta?.annotation ? escapeHtml(meta.annotation) : "—";
        infoRows.push(`<div style="margin-top: 4px; color: var(--b3-theme-on-surface-light);">备注: <span style="font-style: italic;">${annotationText}</span></div>`);

        // 来源
        const sourceText = meta?.source ? escapeHtml(meta.source) : "本地";
        infoRows.push(`<div style="margin-top: 4px; color: var(--b3-theme-on-surface-light); opacity: 0.7;">来源: ${sourceText}</div>`);

        element.innerHTML = infoRows.join("");
        element.addEventListener("click", handlePaletteClick);
    } catch (error) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div style="color: var(--b3-theme-error);">元数据加载失败: ${escapeHtml(String(error))}</div>`;
        }
    }
};

/**
 * 异步加载文本预览内容
 * 
 * @param path - 文件路径
 * @param elementId - 目标元素 ID
 */
const loadTextPreview = async (path: string, elementId: string) => {
    try {
        // 通过静态文件路由获取内容
        const response = await fetch(`/${path}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // 限制读取大小，避免大文件卡顿
        const text = await response.text();
        const maxLength = 10000; // 最多显示 10000 字符
        const truncated = text.length > maxLength;
        const content = truncated ? text.substring(0, maxLength) + "\n\n... (内容已截断)" : text;

        // 更新元素内容
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = content;
        }
    } catch (error) {
        // 加载失败时显示错误信息
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div style="color: var(--b3-theme-error);">无法加载预览: ${escapeHtml(String(error))}</div>`;
        }
    }
};

/**
 * HTML 转义，防止 XSS
 */
const escapeHtml = (text: string) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
};

/**
 * 重新调整 PDF 查看器的尺寸
 * 
 * 作用：遍历所有打开的 PDF 资源，更新其查看器的缩放和滚动位置
 * 意图：窗口大小变化后保持 PDF 的显示状态正确
 * 调用时机：窗口 resize 事件触发时
 * 
 * 已知问题：
 *   - https://github.com/siyuan-note/siyuan/issues/8097
 *   - https://github.com/siyuan-note/siyuan/issues/6890
 */
export const pdfResize = () => {
    if (isMobile) {
        return;
    }
    for (const item of getAllModels().asset) {
        const pdfInstance = item.pdfObject;
        if (!pdfInstance) {
            continue;
        }
        const { pdfDocument, pdfViewer } = pdfInstance;
        if (!pdfDocument) {
            continue;
        }
        // https://github.com/siyuan-note/siyuan/issues/8097
        const pdfViewerElement = item.element.querySelector("#viewerContainer");
        if (!pdfViewerElement || pdfViewerElement.clientHeight === 0) {
            continue;
        }
        const scrollTop = pdfViewerElement?.getAttribute("data-scrolltop");
        if (pdfViewerElement && scrollTop) {
            // https://github.com/siyuan-note/siyuan/issues/6890
            pdfViewerElement.scrollTo(0, parseInt(scrollTop));
            pdfViewerElement.removeAttribute("data-scrolltop");
        }
        const currentScaleValue = pdfViewer.currentScaleValue;
        if (
            currentScaleValue === "auto" ||
            currentScaleValue === "page-fit" ||
            currentScaleValue === "page-width"
        ) {
            // Note: the scale is constant for 'page-actual'.
            pdfViewer.currentScaleValue = currentScaleValue;
        }
        pdfViewer.update();
    }
};

/**
 * 生成资源插入的 HTML
 * 
 * 作用：根据资源类型生成对应的编辑器 HTML（音频/视频节点、图片 span、或链接）
 * 意图：将资源插入到编辑器内容中时使用
 * 调用时机：用户通过资源菜单选择并确认插入资源时
 * 
 * @param type - 文件扩展名（如 ".png"、".mp3"）
 * @param pathString - 资源路径
 * @param imgName - 图片的 alt 属性值
 * @param linkName - 链接的显示文本
 * @param htmlAsIframe - 为 true 且链接指向 HTML 文件时，插入沙箱 iframe 节点
 * @returns 对应类型的 HTML 字符串
 */
export const genAssetHTML = (type: string, pathString: string, imgName: string, linkName: string, htmlAsIframe = false) => {
    // HTML 资源在明确要求以 iframe 插入且链接指向 HTML 文件时，生成沙箱隔离的 NodeIFrame 节点。
    if (htmlAsIframe && isHTMLFilePath(linkName)) {
        const iframeSrc = escapeAttr(getHTMLAssetIFrameSrc(pathString));
        return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeIFrame" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}"><div class="iframe-content">${Constants.ZWSP}<iframe sandbox="allow-scripts" src="${iframeSrc}" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe><span class="protyle-action__drag" contenteditable="false"></span></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    const format = getAssetFormat(type);
    if (format.previewKind === "audio") {
        return /*html*/`
        <div data-node-id="${Lute.NewNodeID()}" data-type="NodeAudio" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}">
        <div class="iframe-content">
        <audio controls="controls" src="${pathString}"></audio>
        ${Constants.ZWSP}
        </div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    // 浏览器无法直接渲染的图片地址按上游约定回退为普通链接，避免生成无法显示的图片节点。
    if (format.previewKind === "image" && isBrowserRenderableImagePath(pathString)) {
        const netHTML = pathString.startsWith("assets/") ? "" : /*html*/`
            <span class="img__net">
                <svg>
                    <use xlink:href="#iconGlobe"></use>
                </svg>
            </span>`;
        return /*html*/`<span contenteditable="false" data-type="img" class="img"><span></span><span><span class="protyle-action protyle-icons"><span class="protyle-icon protyle-icon--only"><svg><use xlink:href="#iconMore"></use></svg></span></span><img src="${pathString}" data-src="${pathString}" alt="${imgName}" /><span class="protyle-action__drag"></span>${netHTML}<span class="protyle-action__title"><span></span></span></span><span> </span></span>`;
    }

    if (format.previewKind === "video") {
        return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeVideo" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}"><div class="iframe-content">${Constants.ZWSP}<video controls="controls" src="${pathString}"></video><span class="protyle-action__drag" contenteditable="false"></span></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    return `<span data-type="a" data-href="${pathString}">${linkName}</span>`;
};
