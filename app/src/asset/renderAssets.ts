import { Constants } from "../constants";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
import { pathPosix } from "../util/pathName";
import * as dayjs from "dayjs";

/** 已知的文本文件扩展名，用于判断是否提供内容预览 */
const TEXT_EXTENSIONS = new Set([
    ".txt", ".md", ".markdown", ".json", ".log", ".sql", ".html", ".xml",
    ".java", ".h", ".c", ".cpp", ".go", ".rs", ".swift", ".kt", ".py",
    ".php", ".js", ".css", ".ts", ".sh", ".bat", ".cmd", ".ini", ".yaml",
    ".yml", ".toml", ".rst", ".adoc", ".textile", ".opml", ".org", ".wiki",
    ".gitignore", ".editorconfig", ".env", ".properties"
]);

/**
 * 判断是否为文本文件
 * 
 * @param ext - 文件扩展名（含前导点）
 * @returns 是否为文本文件
 */
const isTextFile = (ext: string): boolean => {
    return TEXT_EXTENSIONS.has(ext.toLowerCase());
};

/**
 * 渲染资源预览 HTML
 * 
 * 作用：根据资源路径生成对应的预览 HTML
 *   - 图片：使用缩略图 API
 *   - 音频/视频：使用原生播放器
 *   - 文本文件：显示文件内容预览
 *   - 其他文件：使用缩略图 API（返回文件图标）
 * 
 * 意图：在资源选择菜单、历史记录等场景中提供资源预览
 * 调用时机：当用户悬停或选择资源列表项时
 * 
 * @param pathString - 资源的相对路径（如 "assets/image.png"）
 * @returns 预览的 HTML 字符串，如果路径为空则返回空字符串
 */
export const renderAssetsPreview = (pathString: string) => {
    if (!pathString) {
        return "";
    }
    const type = pathPosix().extname(pathString).toLowerCase();

    // 图片：使用缩略图 API
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
        const thumbnailUrl = `/api/s-forge/thumbnail?path=${encodeURIComponent(pathString)}&size=360`;
        return `<img style="max-height: 100%" src="${thumbnailUrl}" data-original="${pathString}">`;
    }

    // 音频：使用原生播放器
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
        return `<audio style="max-width: 100%" controls="controls" src="${pathString}"></audio>`;
    }

    // 视频：使用原生播放器
    if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
        return `<video style="max-width: 100%" controls="controls" src="${pathString}"></video>`;
    }

    // 文本文件：显示异步加载占位符，然后加载内容
    if (isTextFile(type)) {
        // 生成唯一 ID 用于后续内容填充
        const previewId = `text-preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 异步加载文本内容
        loadTextPreview(pathString, previewId);

        return `<div id="${previewId}" class="fn__flex-column" style="width: 100%; height: 100%; overflow: auto; padding: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; background: var(--b3-theme-surface); border-radius: 4px;">
            <div class="fn__loading" style="height: 100%;"></div>
        </div>`;
    }

    // 其他文件：使用缩略图 API 获取文件图标
    const thumbnailUrl = `/api/s-forge/thumbnail?path=${encodeURIComponent(pathString)}&size=256`;
    return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <img style="max-width: 128px; max-height: 128px;" src="${thumbnailUrl}">
        <div style="margin-top: 8px; color: var(--b3-theme-on-surface); font-size: 12px; word-break: break-all; text-align: center; max-width: 100%;">
            ${escapeHtml(pathPosix().basename(pathString))}
        </div>
    </div>`;
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
const escapeHtml = (text: string): string => {
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
    /// #if !MOBILE
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
    /// #endif
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
 * @returns 对应类型的 HTML 字符串
 */
export const genAssetHTML = (type: string, pathString: string, imgName: string, linkName: string) => {
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
        return /*html*/`
        <div data-node-id="${Lute.NewNodeID()}" data-type="NodeAudio" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}">
        <div class="iframe-content">
        <audio controls="controls" src="${pathString}"></audio>
        ${Constants.ZWSP}
        </div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
        const netHTML = pathString.startsWith("assets/") ? "" : /*html*/`
            <span class="img__net">
                <svg>
                    <use xlink:href="#iconLanguage"></use>
                </svg>
            </span>`;
        return /*html*/`<span contenteditable="false" data-type="img" class="img"><span></span><span><span class="protyle-action protyle-icons"><span class="protyle-icon protyle-icon--only"><svg><use xlink:href="#iconMore"></use></svg></span></span><img src="${pathString}" data-src="${pathString}" alt="${imgName}" /><span class="protyle-action__drag"></span>${netHTML}<span class="protyle-action__title"><span></span></span></span><span> </span></span>`;
    }

    if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
        return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeVideo" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}"><div class="iframe-content">${Constants.ZWSP}<video controls="controls" src="${pathString}"></video><span class="protyle-action__drag" contenteditable="false"></span></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    return `<span data-type="a" data-href="${pathString}">${linkName}</span>`;
};
