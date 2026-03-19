/**
 * 用途：渲染素材预览 HTML
 * 使用范围：资源列表 hover 与预览面板初始化
 * 解耦评估：通过 imports.ts 转发，预览渲染能力与业务编排解耦
 */
import { renderAssetsPreview } from "./imports";
/**
 * 用途：请求后端素材元数据
 * 使用范围：预览面板更新调色板、尺寸、大小、评分
 * 解耦评估：通过 imports.ts 转发，网络请求实现可统一替换
 */
import { fetchPost } from "./imports";
/**
 * 用途：获取国际化文案
 * 使用范围：资源列表空态文案渲染
 * 解耦评估：通过 imports.ts 转发，i18n 来源与业务解耦
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：判断移动端布局
 * 使用范围：菜单模板中的列布局和高度策略
 * 解耦评估：通过 imports.ts 转发，端类型判断能力集中管理
 */
import { isMobile } from "./imports";
/**
 * 用途：读取窗口外部宽度
 * 使用范围：判断是否隐藏右侧预览区
 * 解耦评估：通过 imports.ts 转发，环境读取能力与业务解耦
 */
import { getWindowOuterWidth } from "./imports";
/**
 * 用途：资源项类型约束
 * 使用范围：资源列表与预览更新函数参数类型
 * 解耦评估：通过 imports.ts 转发类型，避免直接上跳父目录
 */
import type { assetItem } from "./imports";

/**
 * 生成资源列表 HTML。
 * @同步豁免: UI构建 - 该函数用于同步构建列表模板字符串，调用方依赖即时返回用于菜单渲染。
 */
export const 生成资源列表HTML = (data: assetItem[]) => {
    return data.map((item, index) => {
        const focusClass = index === 0 ? " b3-list-item--focus" : "";
        return `<div data-value="${item.path}" class="b3-list-item${focusClass}"><div class="b3-list-item__text">${item.hName}</div></div>`;
    }).join("");
};

/**
 * 处理素材元数据响应并更新预览区域。
 */
const 处理素材元数据响应 = (
    previewElement: Element,
    response: {
        code: number;
        data?: {
            palettes?: Array<{ color: number[] }>;
            width?: number;
            height?: number;
            fileSize?: number;
            star?: number;
        };
    }
) => {
    // 后端返回异常或无数据时不更新任何预览字段，避免覆盖已有展示。
    if (response.code !== 0 || !response.data) {
        return;
    }
    const meta = response.data;

    const paletteContainer = previewElement.querySelector("#preview-palette");
    // 只有在预览容器存在且后端提供调色板时才渲染色块。
    if (paletteContainer && meta.palettes && meta.palettes.length > 0) {
        paletteContainer.innerHTML = meta.palettes.map((p: { color: number[] }) => {
            const color = `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`;
            return `<div style="width: 24px; height: 24px; background: ${color}; border-radius: 2px;"></div>`;
        }).join("");
    }

    const sizeEl = previewElement.querySelector("#preview-size");
    // 仅在 width/height 都有效时显示尺寸，避免展示不完整信息。
    if (sizeEl && meta.width && meta.height) {
        sizeEl.textContent = `${meta.width} × ${meta.height}`;
    }

    const filesizeEl = previewElement.querySelector("#preview-filesize");
    // 后端返回 fileSize 时才显示大小，否则保留默认占位符。
    if (filesizeEl && meta.fileSize) {
        const kb = meta.fileSize / 1024;
        const sizeText = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
        filesizeEl.textContent = sizeText;
    }

    const ratingEl = previewElement.querySelector("#preview-rating");
    if (ratingEl) {
        ratingEl.textContent = meta.star > 0 ? "★".repeat(meta.star) : "-";
    }
};

/**
 * 更新素材元数据预览。
 * @同步豁免: UI构建 - 函数同步触发请求并在回调里更新当前 DOM，调用链依赖同步返回以保持事件处理顺序。
 */
export const 更新素材元数据预览 = (previewElement: Element, assetPath: string) => {
    if (!assetPath) {
        return;
    }
    const requestData = { path: assetPath };
    fetchPost("/api/s-forge/asset-meta/get", requestData, (response) => 处理素材元数据响应(previewElement, response));
};

/**
 * 更新资源列表 UI。
 * @同步豁免: UI构建 - 列表 DOM 需要在同一事件循环中同步刷新以匹配键盘导航状态。
 */
export const 更新资源列表UI = (listElement: Element, data: assetItem[]) => {
    const searchHTML = 生成资源列表HTML(data);
    listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
};

/**
 * 更新预览区域内容。
 * @同步豁免: UI构建 - 预览区 DOM 变更需要同步执行，避免 hover 与列表焦点出现错位。
 */
export const 更新预览区域 = (previewElement: Element | null, data: assetItem[]) => {
    if (!previewElement) {
        return;
    }
    const imageContainer = previewElement.querySelector("#preview-image");
    // 有首个资源且预览容器存在时，默认展示首项并加载元数据。
    if (data.length > 0 && data[0] && imageContainer) {
        const firstItem = data[0];
        imageContainer.innerHTML = renderAssetsPreview(firstItem.path);
        更新素材元数据预览(previewElement, firstItem.path);
        return;
    }
    if (imageContainer) {
        imageContainer.innerHTML = siyuanI18n.emptyContent;
    }
};

/**
 * 判断预览区域是否应该隐藏。
 * @同步豁免: UI构建 - 该函数只读当前环境并同步返回布尔值，用于模板分支渲染。
 */
export const 应该隐藏预览区域 = () => {
    const outerWidth = getWindowOuterWidth();
    return isMobile || outerWidth < outerWidth / 2 + 260;
};

/**
 * 生成菜单 HTML 模板。
 * @同步豁免: UI构建 - 模板字符串需要同步构建并立即用于菜单项渲染。
 */
export const 生成菜单HTML模板 = () => {
    const maxHeight = isMobile ? "80" : "50";
    const columnStyle = isMobile ? "width:100%" : "min-width: 280px;max-width:420px";
    const previewDisplay = 应该隐藏预览区域() ? "none" : "flex";

    return `<div class="fn__flex" style="max-height: ${maxHeight}vh">
<div class="fn__flex-column" style="${columnStyle}">
    <div class="fn__flex" style="margin: 0 8px 4px 8px">
        <input class="b3-text-field fn__flex-1" placeholder="搜索素材..."/>
        <span class="fn__space"></span>
        <span data-type="previous" class="block__icon block__icon--show"><svg><use xlink:href="#iconLeft"></use></svg></span>
        <span class="fn__space"></span>
        <span data-type="next" class="block__icon block__icon--show"><svg><use xlink:href="#iconRight"></use></svg></span>
    </div>
    <div class="fn__flex" style="margin: 0 8px 8px 8px; gap: 4px;">
        <button data-type="filter-type" class="b3-button b3-button--outline b3-button--small">Type ▼</button>
        <button data-type="filter-size" class="b3-button b3-button--outline b3-button--small">Size ▼</button>
        <button data-type="filter-rating" class="b3-button b3-button--outline b3-button--small">Rating ▼</button>
        <button data-type="filter-color" class="b3-button b3-button--outline b3-button--small">Color ▼</button>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"><img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg"></div>
</div>
<div id="preview" class="fn__flex-column" style="width: 360px;display: ${previewDisplay};padding: 8px;overflow: auto;gap: 8px;">
    <div id="preview-image" style="flex: 1; display: flex; justify-content: center; align-items: center;"></div>
    <div id="preview-palette" style="display: flex; gap: 2px; flex-wrap: wrap;"></div>
    <div id="preview-info" style="font-size: 12px; color: var(--b3-theme-on-surface-light);">
        <div>尺寸: <span id="preview-size">-</span></div>
        <div>大小: <span id="preview-filesize">-</span></div>
        <div>评分: <span id="preview-rating">-</span></div>
    </div>
</div>
</div>`;
};
