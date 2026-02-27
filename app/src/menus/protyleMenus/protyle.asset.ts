import { focusToolbarRange } from "../../protyle/util/selection";
import { renderAssetsPreview } from "../../asset/renderAssets";
import { openAssetDialog } from "../../asset/assetDialog";
import { Menu } from "../../plugin/Menu";
import { MenuItem } from "../Menu.Item";
import { hintRenderAssets } from "../../protyle/hint/extend";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { isMobile } from "../../platform";
import { upDownHint } from "../../util/DOM/upDownHint";
import { fetchPost } from "../../ai/imports";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { getWindowOuterWidth } from "../../util/siyuanEnvironments/getWindowGeometry.environment";
import { assetItem } from "./protyle.types";
import { isAssetItemArray } from "./protyle.asset.guard";

/** 生成资源列表 HTML */
const 生成资源列表HTML = (data: assetItem[]) => {
    return data.map((item, index) => {
        const focusClass = index === 0 ? " b3-list-item--focus" : "";
        return `<div data-value="${item.path}" class="b3-list-item${focusClass}"><div class="b3-list-item__text">${item.hName}</div></div>`;
    }).join("");
};

/**
 * 更新素材元数据预览
 * @description 调用后端 API 获取素材元数据，更新预览区的调色板、尺寸、大小、评分等信息
 * @param previewElement - 预览容器元素
 * @param assetPath - 素材路径
 */
const 更新素材元数据预览 = (previewElement: Element, assetPath: string) => {
    fetchPost("/api/s-forge/asset-meta/get", { path: assetPath }, (response) => {
        if (response.code !== 0 || !response.data) {
            return;
        }
        const meta = response.data;

        // 更新调色板
        const paletteContainer = previewElement.querySelector("#preview-palette");
        if (paletteContainer && meta.palettes && meta.palettes.length > 0) {
            paletteContainer.innerHTML = meta.palettes.map((p: { color: number[] }) => {
                const color = `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`;
                return `<div style="width: 24px; height: 24px; background: ${color}; border-radius: 2px;"></div>`;
            }).join("");
        }

        // 更新尺寸
        const sizeEl = previewElement.querySelector("#preview-size");
        if (sizeEl && meta.width && meta.height) {
            sizeEl.textContent = `${meta.width} × ${meta.height}`;
        }

        // 更新文件大小
        const filesizeEl = previewElement.querySelector("#preview-filesize");
        if (filesizeEl && meta.fileSize) {
            const kb = meta.fileSize / 1024;
            const sizeText = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
            filesizeEl.textContent = sizeText;
        }

        // 更新评分
        const ratingEl = previewElement.querySelector("#preview-rating");
        if (ratingEl) {
            ratingEl.textContent = meta.star > 0 ? "★".repeat(meta.star) : "-";
        }
    });
};

/** 更新资源列表 UI */
const 更新资源列表UI = (listElement: Element, data: assetItem[]) => {
    const searchHTML = 生成资源列表HTML(data);
    listElement.innerHTML = searchHTML || `<li class="b3-list--empty">${siyuanI18n.emptyContent}</li>`;
};

/** 更新预览区域（包含图片、调色板、尺寸等信息） */
const 更新预览区域 = (previewElement: Element | null, data: assetItem[]) => {
    if (!previewElement) {
        return;
    }
    const imageContainer = previewElement.querySelector("#preview-image");
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

/** 弹出菜单 */
const 弹出菜单 = (position: IPosition) => {
    // 移动端使用全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenus().menu.fullscreen();
        return;
    }
    // 非移动端使用弹出菜单
    getSiyuanGlobalMenus().menu.popup(position);
};

/** 处理搜索资源的响应 */
const 处理搜索资源响应 = (
    element: Element,
    k: string,
    position: IPosition,
    data: assetItem[]
) => {
    const inputElement = element.querySelector("input");
    const previewElement = element.querySelector("#preview");
    const listElement = element.querySelector(".b3-list");

    if (listElement) {
        更新资源列表UI(listElement, data);
    }
    更新预览区域(previewElement, data);
    弹出菜单(position);

    if (!k && inputElement) {
        inputElement.select();
    }
};

/**
 * 渲染资源列表
 * @作用 根据搜索关键词和扩展名过滤条件，从后端获取资源列表并更新 UI
 * @意图 作为资源选择菜单/对话框的核心渲染入口，统一处理搜索请求和 UI 更新
 * @调用时机
 *   - 菜单/对话框初始化时（k 为空字符串）
 *   - 用户输入搜索关键词时（input 事件）
 *   - 用户修改文件类型过滤条件时
 * @param element - 菜单容器元素
 * @param k - 搜索关键词
 * @param position - 菜单弹出位置
 * @param exts - 文件扩展名过滤列表，如 [".png", ".jpg"]
 */
export const renderAssetList = (element: Element, k: string, position: IPosition, exts: string[] = []) => {
    fetchPost("/api/search/searchAsset", { k, exts }, (response) => {
        const rawData = response.data ?? [];
        const data: assetItem[] = isAssetItemArray(rawData) ? rawData : [];
        处理搜索资源响应(element, k, position, data);
    });
};

/** 处理列表悬停事件，更新预览图像和元数据 */
const 处理列表悬停 = (previewElement: Element) => (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const hoverItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!hoverItemElement) {
        return;
    }
    const dataValue = hoverItemElement.getAttribute("data-value") ?? "";
    const imageContainer = previewElement.querySelector("#preview-image");
    if (imageContainer) {
        imageContainer.innerHTML = renderAssetsPreview(dataValue);
    }
    更新素材元数据预览(previewElement, dataValue);
};

/** 处理 Enter 键事件 */
const 处理Enter键 = (
    element: Element,
    previewElement: Element,
    event: KeyboardEvent,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => {
    const isEmpty = element.querySelector(".b3-list--empty");

    // 列表为空时，如果没有回调，则关闭菜单并聚焦
    if (isEmpty && !callback) {
        getSiyuanGlobalMenus().menu.remove();
        focusToolbarRange(protyle);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 列表为空时，有回调则不做任何事
    if (isEmpty) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // 列表不为空，选择当前项
    const currentElement = element.querySelector(".b3-list-item--focus");
    if (!currentElement) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    const dataValue = currentElement.getAttribute("data-value") ?? "";
    const textContent = currentElement.textContent ?? "";

    if (callback) {
        callback(dataValue, textContent);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    hintRenderAssets(dataValue, protyle);
    getSiyuanGlobalMenus().menu.remove();
    event.preventDefault();
    event.stopPropagation();
};

/** 处理 Escape 键事件 */
const 处理Escape键 = (protyle: IProtyle, callback?: (url: string, name: string) => void) => {
    if (callback) {
        return;
    }
    focusToolbarRange(protyle);
};

/** 处理键盘事件 */
const 处理键盘事件 = (
    element: Element,
    listElement: Element,
    previewElement: Element,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => (event: KeyboardEvent) => {
    if (event.isComposing) {
        return;
    }

    const isEmpty = element.querySelector(".b3-list--empty");

    // 处理上下方向键
    const currentElement = !isEmpty ? upDownHint(listElement, event) : null;
    if (currentElement) {
        const dataValue = currentElement.getAttribute("data-value") ?? "";
        previewElement.innerHTML = renderAssetsPreview(dataValue);
        event.stopPropagation();
    }

    if (event.key === "Enter") {
        处理Enter键(element, previewElement, event, protyle, callback);
        return;
    }

    if (event.key === "Escape") {
        处理Escape键(protyle, callback);
    }
};

/** 处理输入事件 */
const 处理输入事件 = (
    element: Element,
    inputElement: HTMLInputElement,
    position: IPosition,
    exts?: string[]
) => (event: Event) => {
    const inputEvent = event as InputEvent;
    if (inputEvent.isComposing) {
        return;
    }
    event.stopPropagation();
    renderAssetList(element, inputElement.value, position, exts);
};

/** 处理组合输入结束事件 */
const 处理组合输入结束 = (
    element: Element,
    inputElement: HTMLInputElement,
    position: IPosition,
    exts?: string[]
) => (event: Event) => {
    event.stopPropagation();
    renderAssetList(element, inputElement.value, position, exts);
};

/** 处理列表点击事件 */
const 处理列表点击 = (
    protyle: IProtyle,
    callback?: (url: string, name: string) => void
) => (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const listItemElement = hasClosestByClassName(target, "b3-list-item");
    if (!listItemElement) {
        return;
    }

    event.stopPropagation();
    const currentURL = listItemElement.getAttribute("data-value") ?? "";
    const textContent = listItemElement.textContent ?? "";

    if (callback) {
        callback(currentURL, textContent);
        return;
    }

    hintRenderAssets(currentURL, protyle);
    getSiyuanGlobalMenus().menu.remove();
};

/**
 * 显示类型过滤下拉菜单
 * @description 在按钮下方显示文件类型过滤选项
 */
const 显示类型过滤菜单 = (
    btn: Element,
    menuElement: HTMLElement,
    inputElement: HTMLInputElement,
    position: IPosition,
    extsRef: { current: string[] }
) => {
    const typeMenu = new Menu("asset-filter-type");
    const types = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];

    for (const ext of types) {
        const isSelected = extsRef.current.includes(ext);
        typeMenu.addItem({
            icon: isSelected ? "iconCheck" : "",
            label: ext,
            click: () => {
                if (isSelected) {
                    extsRef.current = extsRef.current.filter(e => e !== ext);
                } else {
                    extsRef.current = [...extsRef.current, ext];
                }
                renderAssetList(menuElement, inputElement.value, position, extsRef.current);
            }
        });
    }

    typeMenu.addSeparator();
    typeMenu.addItem({
        label: "清除过滤",
        click: () => {
            extsRef.current = [];
            renderAssetList(menuElement, inputElement.value, position, extsRef.current);
        }
    });

    const btnRect = btn.getBoundingClientRect();
    typeMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 显示尺寸过滤下拉菜单
 */
const 显示尺寸过滤菜单 = (btn: Element) => {
    const sizeMenu = new Menu("asset-filter-size");
    const sizes = ["小 (< 500px)", "中 (500-2000px)", "大 (> 2000px)", "全部"];

    for (const size of sizes) {
        sizeMenu.addItem({
            label: size,
            click: () => {
                // TODO: 实现尺寸过滤
            }
        });
    }

    const btnRect = btn.getBoundingClientRect();
    sizeMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 显示评分过滤下拉菜单
 */
const 显示评分过滤菜单 = (btn: Element) => {
    const ratingMenu = new Menu("asset-filter-rating");
    const ratings = ["★★★★★", "★★★★☆ 以上", "★★★☆☆ 以上", "★★☆☆☆ 以上", "★☆☆☆☆ 以上", "全部"];

    for (const rating of ratings) {
        ratingMenu.addItem({
            label: rating,
            click: () => {
                // @AITODO: 实现评分过滤
            }
        });
    }

    const btnRect = btn.getBoundingClientRect();
    ratingMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 显示颜色过滤下拉菜单
 */
const 显示颜色过滤菜单 = (btn: Element) => {
    const colorMenu = new Menu("asset-filter-color");
    colorMenu.addItem({
        label: "颜色过滤功能开发中...",
        click: () => { }
    });

    const btnRect = btn.getBoundingClientRect();
    colorMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/** 判断预览区域是否应该隐藏 */
const 应该隐藏预览区域 = () => {
    const outerWidth = getWindowOuterWidth();
    return isMobile || outerWidth < outerWidth / 2 + 260;
};

/** 绑定菜单元素事件 */
const 绑定菜单元素事件 = (
    element: HTMLElement,
    position: IPosition,
    protyle: IProtyle,
    callback?: (url: string, name: string) => void,
    exts?: string[]
) => {
    element.style.maxWidth = "none";
    const listElement = element.querySelector(".b3-list");
    const previewElement = element.querySelector("#preview");
    const inputElement = element.querySelector("input");

    if (!listElement || !previewElement || !inputElement) {
        return;
    }

    // 使用引用对象以便在过滤对话框中修改
    const extsRef = { current: exts ?? [] };

    listElement.addEventListener("mouseover", 处理列表悬停(previewElement));
    listElement.addEventListener("click", 处理列表点击(protyle, callback));
    inputElement.addEventListener("keydown", 处理键盘事件(element, listElement, previewElement, protyle, callback));
    inputElement.addEventListener("input", 处理输入事件(element, inputElement, position, extsRef.current));
    inputElement.addEventListener("compositionend", 处理组合输入结束(element, inputElement, position, extsRef.current));

    // 为过滤按钮绑定下拉菜单事件
    const typeBtn = element.querySelector("[data-type='filter-type']");
    const sizeBtn = element.querySelector("[data-type='filter-size']");
    const ratingBtn = element.querySelector("[data-type='filter-rating']");
    const colorBtn = element.querySelector("[data-type='filter-color']");

    typeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示类型过滤菜单(typeBtn, element, inputElement, position, extsRef);
    });
    sizeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示尺寸过滤菜单(sizeBtn);
    });
    ratingBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示评分过滤菜单(ratingBtn);
    });
    colorBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示颜色过滤菜单(colorBtn);
    });

    // 上一个/下一个按钮
    const prevBtn = element.querySelector("[data-type='previous']");
    const nextBtn = element.querySelector("[data-type='next']");
    prevBtn?.addEventListener("click", () => {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    nextBtn?.addEventListener("click", () => {
        inputElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });

    renderAssetList(element, "", position, extsRef.current);
};

/** 生成菜单 HTML 模板，包含 Type/Size/Rating/Color 过滤按钮 */
const 生成菜单HTML模板 = () => {
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

/**
 * 资源选择菜单
 * @description 移动端使用原有 Menu 实现，桌面端使用全局单例 Dialog
 * @param protyle - 编辑器实例（移动端需要）
 * @param position - 位置信息（移动端需要）
 * @param callback - 可选的回调函数，选中资源时调用
 * @param exts - 文件扩展名过滤列表
 */
export const assetMenu = (
    protyle: IProtyle,
    position: IPosition,
    callback?: (url: string, name: string) => void,
    exts?: string[]
) => {
    // 移动端保持原有 Menu 实现
    if (isMobile) {
        const menu = getSiyuanGlobalMenus().menu;
        menu.remove();
        menu.append(new MenuItem({
            iconHTML: "",
            type: "readonly",
            label: 生成菜单HTML模板(),
            bind(element) {
                绑定菜单元素事件(element, position, protyle, callback, exts);
            }
        }).element);
        menu.popup(position);
        return;
    }
    // 桌面端使用全局单例 Dialog，由发起方通过 callback 控制插入行为
    openAssetDialog(callback ?? ((url: string) => {
        hintRenderAssets(url, protyle);
    }));
};
