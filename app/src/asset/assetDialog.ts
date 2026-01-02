/**
 * 全局资源选择对话框
 * @description 单例模式实现的资源选择器，在桌面端全局唯一
 * 
 * 功能特性：
 * - 桌面端全局单例，避免重复创建
 * - 根据当前活跃编辑器决定插入位置
 * - 支持搜索、类型过滤、预览
 * 
 * 使用方式：
 * - 调用 openAssetDialog() 打开对话框
 * - 可传入 callback 自定义插入行为
 */

import { Dialog } from "../dialog";
import { fetchPost } from "../ai/imports";
import { isMobile } from "../util/functions";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { getWindowOuterWidth } from "../util/siyuanEnvironments/getWindowGeometry.environment";
import { Menu } from "../plugin/Menu";
import { renderAssetsPreview } from "./renderAssets";
import { hintRenderAssets } from "../protyle/hint/extend";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
/// #if !MOBILE
import { getAllEditor } from "../layout/getAll";
/// #endif

/** 资源列表项类型 */
interface AssetItem {
    hName: string;
    path: string;
}

/** 全局对话框实例 */
let dialogInstance: Dialog | null = null;

/** 当前过滤条件 */
let currentExts: string[] = [];

/**
 * 获取当前活跃的 protyle 编辑器
 * @description 遍历所有编辑器，找到包含焦点或光标的那个
 */
const 获取活跃编辑器 = (): IProtyle | null => {
    /// #if MOBILE
    return window.siyuan.mobile?.editor?.protyle ?? null;
    /// #else
    const editors = getAllEditor();

    // 优先查找包含焦点的编辑器
    for (const editor of editors) {
        const protyle = editor.protyle;
        if (!protyle?.wysiwyg?.element) {
            continue;
        }

        // 检查是否包含焦点
        if (protyle.wysiwyg.element.contains(document.activeElement)) {
            return protyle;
        }

        // 检查是否有选区
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (protyle.wysiwyg.element.contains(range.commonAncestorContainer)) {
                return protyle;
            }
        }
    }

    // 如果没有活跃编辑器，返回第一个可用的
    for (const editor of editors) {
        if (editor.protyle?.wysiwyg?.element) {
            return editor.protyle;
        }
    }

    return null;
    /// #endif
};

/**
 * 生成资源列表 HTML
 */
const 生成资源列表HTML = (data: AssetItem[]) => {
    let html = "";
    for (const item of data) {
        const iconHTML = renderAssetsPreview(item.path);
        html += `<div data-value="${item.path}" class="b3-list-item b3-list-item--hide-action">
            ${iconHTML}
            <span class="b3-list-item__text">${item.hName}</span>
        </div>`;
    }
    return html;
};

/**
 * 渲染资源列表
 */
const renderAssetList = (
    element: Element,
    searchKey: string,
    exts?: string[]
) => {
    const listElement = element.querySelector(".b3-list");
    if (!listElement) {
        return;
    }

    // @内联回调
    fetchPost("/api/search/searchAsset", {
        k: searchKey,
        exts: exts || []
    }, (response) => {
        if (!response.data || response.data.length === 0) {
            listElement.innerHTML = `<div class="b3-list-item" style="justify-content: center; color: var(--b3-theme-on-surface-light);">
                ${siyuanI18n.emptyContent || "暂无内容"}
            </div>`;
            return;
        }

        listElement.innerHTML = 生成资源列表HTML(response.data);

        // 选中第一个
        const firstItem = listElement.querySelector(".b3-list-item");
        if (firstItem) {
            firstItem.classList.add("b3-list-item--focus");
        }
    });
};

/**
 * 更新预览区域
 */
const 更新预览区域 = (previewElement: Element, path: string) => {
    const previewImageElement = previewElement.querySelector("#preview-image");
    if (!previewImageElement) {
        return;
    }

    const iconHTML = renderAssetsPreview(path);
    previewImageElement.innerHTML = iconHTML;

    // TODO: 加载详细元数据（调色板、尺寸等）
};

/**
 * 生成对话框内容 HTML
 */
const 生成对话框内容HTML = () => {
    const previewDisplay = isMobile() ? "none" : "flex";

    return `<div class="fn__flex" style="height: 100%;">
<div class="fn__flex-column" style="flex: 1; min-width: 280px;">
    <div class="fn__flex" style="margin: 8px;">
        <input class="b3-text-field fn__flex-1" placeholder="${siyuanI18n.search || "搜索"}..."/>
    </div>
    <div class="fn__flex" style="margin: 0 8px 8px 8px; gap: 4px;">
        <button data-type="filter-type" class="b3-button b3-button--outline b3-button--small">Type ▼</button>
        <button data-type="filter-size" class="b3-button b3-button--outline b3-button--small">Size ▼</button>
        <button data-type="filter-rating" class="b3-button b3-button--outline b3-button--small">Rating ▼</button>
        <button data-type="filter-color" class="b3-button b3-button--outline b3-button--small">Color ▼</button>
    </div>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative; overflow: auto;">
        <img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg">
    </div>
</div>
<div id="preview" class="fn__flex-column" style="width: 300px;display: ${previewDisplay};padding: 8px;overflow: auto;gap: 8px;border-left: 1px solid var(--b3-border-color);">
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
 * 显示类型过滤菜单
 */
const 显示类型过滤菜单 = (
    btn: Element,
    element: HTMLElement,
    inputElement: HTMLInputElement
) => {
    const menu = new Menu("asset-filter-type");
    const types = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];

    for (const ext of types) {
        const isSelected = currentExts.includes(ext);
        menu.addItem({
            icon: isSelected ? "iconCheck" : "",
            label: ext,
            click: () => {
                if (isSelected) {
                    currentExts = currentExts.filter(e => e !== ext);
                } else {
                    currentExts = [...currentExts, ext];
                }
                renderAssetList(element, inputElement.value, currentExts);
            }
        });
    }

    menu.addSeparator();
    menu.addItem({
        label: "清除过滤",
        click: () => {
            currentExts = [];
            renderAssetList(element, inputElement.value, currentExts);
        }
    });

    const btnRect = btn.getBoundingClientRect();
    menu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 绑定对话框事件
 */
const 绑定对话框事件 = (
    element: HTMLElement,
    dialog: Dialog,
    callback?: (url: string, name: string) => void
) => {
    const listElement = element.querySelector(".b3-list");
    const previewElement = element.querySelector("#preview");
    const inputElement = element.querySelector("input");

    if (!listElement || !inputElement) {
        return;
    }

    // 列表悬停预览
    listElement.addEventListener("mouseover", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const listItem = hasClosestByClassName(target, "b3-list-item");
        if (!listItem || !previewElement) {
            return;
        }

        // 移除其他焦点
        listElement.querySelectorAll(".b3-list-item--focus").forEach(item => {
            item.classList.remove("b3-list-item--focus");
        });
        listItem.classList.add("b3-list-item--focus");

        const path = listItem.getAttribute("data-value");
        if (path) {
            更新预览区域(previewElement, path);
        }
    });

    // 列表点击插入
    listElement.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const listItem = hasClosestByClassName(target, "b3-list-item");
        if (!listItem) {
            return;
        }

        e.stopPropagation();
        const currentURL = listItem.getAttribute("data-value") ?? "";
        const textContent = listItem.textContent ?? "";

        dialog.destroy();
        dialogInstance = null;

        if (callback) {
            callback(currentURL, textContent);
            return;
        }

        // 获取当前活跃编辑器并插入
        const protyle = 获取活跃编辑器();
        if (protyle) {
            hintRenderAssets(currentURL, protyle);
        }
    });

    // 搜索输入
    inputElement.addEventListener("input", () => {
        renderAssetList(element, inputElement.value, currentExts);
    });

    inputElement.addEventListener("compositionend", () => {
        renderAssetList(element, inputElement.value, currentExts);
    });

    // 过滤按钮
    const typeBtn = element.querySelector("[data-type='filter-type']");
    typeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        显示类型过滤菜单(typeBtn, element, inputElement);
    });

    // TODO: 其他过滤按钮

    // 初始加载
    renderAssetList(element, "", currentExts);
    inputElement.focus();
};

/**
 * 打开资源选择对话框
 * @description 全局单例模式，桌面端只会有一个实例
 * @param callback 可选的回调函数，选中资源时调用。如不传入则插入到当前活跃编辑器
 */
export const openAssetDialog = (callback?: (url: string, name: string) => void) => {
    // 如果已存在实例，聚焦到它
    if (dialogInstance) {
        const inputElement = dialogInstance.element.querySelector("input");
        inputElement?.focus();
        return;
    }

    // 重置过滤条件
    currentExts = [];

    dialogInstance = new Dialog({
        title: siyuanI18n.insertAsset || "插入素材",
        content: `<div class="b3-dialog__content" style="padding: 0; height: 100%;">
            ${生成对话框内容HTML()}
        </div>`,
        width: isMobile() ? "90vw" : "720px",
        height: "70vh",
        disableScrimClose: true,  // 点击遮罩不关闭
        closeButtonPosition: "inside",  // 关闭按钮内置在标题栏
        destroyCallback: () => {
            dialogInstance = null;
        }
    });

    const element = dialogInstance.element.querySelector(".b3-dialog__content");
    if (!(element instanceof HTMLElement)) {
        return;
    }

    绑定对话框事件(element, dialogInstance, callback);
};

/**
 * 关闭资源选择对话框
 */
export const closeAssetDialog = () => {
    if (dialogInstance) {
        dialogInstance.destroy();
        dialogInstance = null;
    }
};
