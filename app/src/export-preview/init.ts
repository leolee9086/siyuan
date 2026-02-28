/**
 * 导出预览页签初始化
 *
 * 作用：作为 TabRegistry 的 init 回调，构建导出预览页签的 DOM 和交互逻辑
 * 意图：将原 protyle Preview 类的渲染与交互逻辑迁移到独立页签，不依赖 protyle 实例
 * 调用时机：通过 openFile({ custom: { id: 'export-preview', data: { blockId } } }) 打开时
 */

import { Custom } from "../layout/dock/Custom";
import { fetchPost } from "../util/network/fetch";
import { processRender } from "../protyle/util/processCode";
import { highlightRender } from "../protyle/render/highlightRender";
import { speechRender } from "../protyle/render/speechRender";
import { previewDocImage } from "../protyle/preview/image";
import { copyPreviewHTMLToX } from "../protyle/preview/copyToX";
import { addActionButtons } from "../protyle/preview/actionButtons";
import { isOnlyMeta, openByMobile } from "../protyle/util/compatibility";
import { isLocalPath, pathPosix } from "../util/file/pathName";
import { Constants } from "../constants";
import { getSearch, isMobile } from "../util/platform/functions";
import { isElectron } from "../platform";
import { openExternal } from "../platform/electron/shell";
import { openInNewWindow } from "../util/siyuanEnvironments/window.environment";
import { getSafeSiyuanMobile } from "../util/siyuanEnvironments/mobile.environment";
import { getSafeSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { openBy } from "../editor/utils.openBy";
import { openAsset } from "../editor/util.openAsset";
import { getAllModels } from "../layout/getAll";
import { hasClosestByAttribute } from "../protyle/util/hasClosest";
import { showMessage } from "../dialog/message";
import { isHTMLElement } from "../util/DOM/element.guard";
import { isExportPreviewData } from "./init.guard";
import { DEFAULT_ACTIONS } from "./constants";
import type { IExportPreviewData } from "./init.types";

/** 设备宽度预设配置 */
const DEVICE_WIDTH_CONFIG: Record<string, { width: string; padding: string }> = {
    desktop: { width: "", padding: "" },
    tablet: { width: "1024px", padding: "8px 16px" },
    mobile: { width: "360px", padding: "8px" },
};

/**
 * 导出预览页签 init 回调
 *
 * 作用：构建页签 DOM、绑定事件、发起渲染请求
 * @同步豁免: UI构建 - TabRegistry init 回调需要同步构建 DOM 结构
 */
export function initExportPreview(model: Custom): void {
    // data 可能来自布局恢复或外部调用，需要校验结构
    if (!isExportPreviewData(model.data)) {
        showMessage("export-preview: missing blockId");
        return;
    }
    const data = model.data;

    // model.element 是 Tab.panelElement，类型为 Element，需要守卫为 HTMLElement
    if (!isHTMLElement(model.element)) {
        return;
    }
    const container = model.element;
    container.classList.add("export-preview-tab");

    const actionElement = buildActionBar();
    const previewElement = buildPreviewArea();
    container.appendChild(actionElement);
    container.appendChild(previewElement);

    // @内联回调
    actionElement.addEventListener("click", (event) => {
        handleActionClick(event, container, actionElement, previewElement, data);
    });

    // @内联回调
    container.addEventListener("click", (event) => {
        handleContentClick(event, container, previewElement, data, model);
    });

    renderPreview(container, previewElement, data.blockId);
}

/** 构建操作按钮栏 */
function buildActionBar(): HTMLDivElement {
    const actionElement = document.createElement("div");
    actionElement.className = "protyle-preview__action";
    const actionHtml: string[] = [];
    addActionButtons(DEFAULT_ACTIONS, actionHtml);
    actionElement.innerHTML = actionHtml.join("");
    return actionElement;
}

/** 构建预览内容区域 */
function buildPreviewArea(): HTMLDivElement {
    const previewElement = document.createElement("div");
    previewElement.className = "b3-typography";
    previewElement.style.overflow = "auto";
    previewElement.style.flex = "1";
    return previewElement;
}

/**
 * 操作按钮点击处理
 *
 * 处理设备宽度切换和复制到第三方平台
 */
function handleActionClick(
    event: Event,
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
): void {
    const eventTarget = event.target;
    // 事件目标可能不是 HTMLElement（如 SVG 内部元素）
    if (!isHTMLElement(eventTarget)) {
        return;
    }
    const target = eventTarget.closest("button");
    // 点击区域不在按钮内时忽略
    if (!target) {
        return;
    }
    const type = target.getAttribute("data-type");
    // 按钮缺少 data-type 属性时忽略
    if (!type) {
        return;
    }

    // 复制到第三方平台的按钮不参与设备宽度切换的高亮逻辑
    if (type === "mp-wechat" || type === "zhihu" || type === "yuque") {
        executeCopyToX(container, previewElement, data.blockId, type);
        return;
    }

    // 应用设备宽度预设
    const config = DEVICE_WIDTH_CONFIG[type];
    // 未知的设备类型时忽略
    if (!config) {
        return;
    }
    previewElement.style.width = config.width;
    previewElement.style.padding = config.padding;

    const buttons = actionElement.querySelectorAll("button");
    for (const item of buttons) {
        item.classList.remove("protyle-preview__action--current");
    }
    target.classList.add("protyle-preview__action--current");
}

/**
 * 预览内容区域点击处理
 *
 * 处理链接跳转、图片预览、大纲同步高亮
 */
function handleContentClick(
    event: Event,
    container: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    model: Custom,
): void {
    // MouseEvent 才有修饰键信息，普通 Event 不处理
    if (!(event instanceof MouseEvent)) {
        return;
    }
    let target = event.target;

    // 从事件目标向上遍历 DOM 树，查找链接或图片元素
    while (isHTMLElement(target) && target !== container) {
        // 点击了链接元素
        if (target.tagName === "A") {
            handleLinkClick(event, target, previewElement, data, model);
            return;
        }
        // 点击了图片元素，打开图片查看器
        if (target.tagName === "IMG") {
            previewDocImage(target.getAttribute("src") || "", data.blockId);
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        target = target.parentElement;
    }

    // 点击了带 id 属性的元素，用于大纲同步定位
    const eventTarget = event.target;
    // hasClosestByAttribute 需要 Node 类型参数
    if (!isHTMLElement(eventTarget)) {
        return;
    }
    const nodeElement = hasClosestByAttribute(eventTarget, "id", null);
    // hasClosestByAttribute 返回 false 或匹配的元素
    if (!nodeElement) {
        return;
    }
    syncOutlineHighlight(container, nodeElement, data.blockId);
}

/**
 * 处理链接点击
 *
 * 支持锚点跳转、移动端打开、本地路径打开、外部链接打开
 */
function handleLinkClick(
    event: MouseEvent,
    target: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    model: Custom,
): void {
    const linkAddress = target.getAttribute("href") || "";

    // 锚点链接：导出预览模式点击块引转换后的脚注跳转
    if (linkAddress.startsWith("#")) {
        const hash = linkAddress.substring(1);
        const scrollTarget = previewElement.querySelector(
            `[data-node-id="${hash}"], [id="${hash}"]`
        );
        scrollTarget?.scrollIntoView();
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    // 移动端使用系统浏览器打开链接
    if (isMobile()) {
        openByMobile(linkAddress);
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    event.stopPropagation();
    event.preventDefault();

    // 本地路径：桌面端支持通过修饰键以不同方式打开
    if (isLocalPath(linkAddress)) {
        handleLocalPathOpen(event, linkAddress, model);
        return;
    }

    // 外部链接：桌面端使用系统浏览器，浏览器端新窗口打开
    if (isElectron) {
        openExternal(linkAddress).catch((e: unknown) => {
            showMessage(String(e));
        });
        return;
    }
    openInNewWindow(linkAddress);
}

/**
 * 处理本地路径打开
 *
 * 根据修饰键选择不同的打开方式
 */
function handleLocalPathOpen(
    event: MouseEvent,
    linkAddress: string,
    model: Custom,
): void {
    // Meta 键（Cmd/Ctrl）：在文件管理器中打开所在文件夹
    if (isOnlyMeta(event)) {
        openBy(linkAddress, "folder");
        return;
    }
    // Shift 键：使用系统默认应用打开
    if (event.shiftKey) {
        openBy(linkAddress, "app");
        return;
    }
    // 资源文件：在思源内部打开
    const ext = pathPosix().extname(linkAddress.split("?")[0] || "");
    // 文件扩展名属于思源支持的资源类型（PDF、图片、音视频等）时，在内部打开
    if (Constants.SIYUAN_ASSETS_EXTS.includes(ext)) {
        const assetPath = linkAddress.split("?page")[0] || linkAddress;
        const pageStr = getSearch("page", linkAddress);
        openAsset(model.app, assetPath, parseInt(pageStr || "0"));
    }
}

/**
 * 同步大纲高亮
 *
 * 点击预览内容中的元素时，同步高亮对应的大纲项
 */
function syncOutlineHighlight(
    container: HTMLElement,
    nodeElement: HTMLElement,
    blockId: string,
): void {
    const selectedItems = container.querySelectorAll(".protyle-wysiwyg--select");
    for (const item of selectedItems) {
        item.classList.remove("selected");
    }
    nodeElement.classList.add("selected");

    // 桌面端通过 model 同步大纲高亮
    if (!isMobile()) {
        for (const item of getAllModels().outline) {
            // 仅同步当前文档对应的大纲面板
            if (item.blockId === blockId) {
                item.setCurrentByPreview(nodeElement);
            }
        }
        return;
    }

    // 移动端通过全局 docks 同步大纲高亮
    getSafeSiyuanMobile()?.docks?.outline?.setCurrentByPreview(nodeElement);
}

/**
 * 复制预览 HTML 到第三方平台
 *
 * 克隆预览内容并调用 copyPreviewHTMLToX 执行复制
 */
function executeCopyToX(
    container: HTMLElement,
    previewElement: HTMLElement,
    blockId: string,
    type: string,
): void {
    const copyElement = previewElement.cloneNode(true);
    // cloneNode(true) 对 HTMLElement 返回同类型节点，但 TS 类型为 Node
    if (!isHTMLElement(copyElement)) {
        return;
    }
    copyPreviewHTMLToX(container, copyElement, blockId, type);
}

/**
 * 处理导出预览 API 响应
 *
 * 渲染预览 HTML 并执行代码高亮、语音、数学公式等后处理
 */
function applyPreviewResponse(
    previewElement: HTMLElement,
    container: HTMLElement,
    response: IWebSocketData,
): void {
    const oldScrollTop = previewElement.scrollTop;
    previewElement.innerHTML = response.data?.html || "";
    processRender(previewElement);
    highlightRender(previewElement);
    const lang = getSafeSiyuanConfig()?.appearance?.lang || "zh_CN";
    speechRender(previewElement, lang);
    previewElement.scrollTop = oldScrollTop;
    const loadingEl = container.querySelector(".fn__loading");
    loadingEl?.remove();
}

/**
 * 调用导出预览 API 并渲染
 */
function renderPreview(
    container: HTMLElement,
    previewElement: HTMLElement,
    blockId: string,
): void {
    container.insertAdjacentHTML("beforeend",
        `<div style="flex-direction: column;" class="fn__loading">
    <img width="48px" src="/stage/loading-pure.svg">
</div>`
    );

    fetchPost("/api/export/preview", { id: blockId }, (response) => {
        applyPreviewResponse(previewElement, container, response);
    });
}
