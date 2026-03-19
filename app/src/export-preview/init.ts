/**
 * 导出预览页签初始化
 *
 * 作用：作为 TabRegistry 的 init 回调，构建导出预览页签的 DOM 和交互逻辑
 * 意图：将普通导出预览与图片导出预览统一挂载到同一个页签宿主中
 * 调用时机：通过 openFile({ custom: { id: 'export-preview', data: { blockId } } }) 打开时
 */

import { Custom } from "../layout/dock/Custom";
import { fetchPost } from "../util/network/fetch";
import { contentRendererRegistry } from "../registry/contentRenderer/ContentRendererRegistry";
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
import { createExportImageTabContext } from "../protyle/export/image/exportImage.context";
import { initializeExportImagePanel } from "../protyle/export/image/exportImage.helpers";
import { isExportPreviewData } from "./init.guard";
import {
    DEFAULT_ACTIONS,
    EXPORT_PREVIEW_DEFAULT_TYPE,
    EXPORT_PREVIEW_IMAGE_TYPE,
    EXPORT_PREVIEW_SET_TYPE_EVENT,
} from "./constants";
import type { IExportPreviewData, TExportPreviewType } from "./init.types";

/** 设备宽度预设配置 */
const DEVICE_WIDTH_CONFIG: Record<string, { width: string; padding: string }> = {
    desktop: { width: "", padding: "" },
    tablet: { width: "1024px", padding: "8px 16px" },
    mobile: { width: "360px", padding: "8px" },
};

interface IExportPreviewViewState {
    deviceType: keyof typeof DEVICE_WIDTH_CONFIG;
    previewType: TExportPreviewType;
    renderToken: number;
}

/**
 * 导出预览页签 init 回调
 *
 * 作用：构建页签 DOM、绑定事件、发起渲染请求
 * @同步豁免: UI构建 - TabRegistry init 回调需要同步构建 DOM 结构
 */
export function initExportPreview(model: Custom): void {
    if (!isExportPreviewData(model.data)) {
        showMessage("export-preview: missing blockId");
        return;
    }
    const data = model.data;

    if (!isHTMLElement(model.element)) {
        return;
    }
    const container = model.element;
    container.classList.add("export-preview-tab");

    const state: IExportPreviewViewState = {
        deviceType: "desktop",
        previewType: data.previewType || EXPORT_PREVIEW_DEFAULT_TYPE,
        renderToken: 0,
    };

    const actionElement = buildActionBar();
    const previewElement = buildPreviewArea();
    container.appendChild(actionElement);
    container.appendChild(previewElement);

    applyDevicePreset(previewElement, state.deviceType);
    syncDeviceActionState(actionElement, state.deviceType);
    syncPreviewTypeActionState(actionElement, state.previewType);

    actionElement.addEventListener("click", (event) => {
        void handleActionClick(event, container, actionElement, previewElement, data, state);
    });

    container.addEventListener("click", (event) => {
        handleContentClick(event, container, previewElement, data, model);
    });

    container.addEventListener(EXPORT_PREVIEW_SET_TYPE_EVENT, (event) => {
        void handlePreviewTypeEvent(event, actionElement, previewElement, data, state);
    });

    void renderByPreviewType(container, actionElement, previewElement, data, state);
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
    previewElement.className = "fn__flex-1";
    previewElement.style.overflow = "auto";
    previewElement.style.minWidth = "1px";
    previewElement.style.margin = "0 auto";
    previewElement.style.boxSizing = "border-box";
    return previewElement;
}

/** 应用设备宽度预设 */
function applyDevicePreset(
    previewElement: HTMLElement,
    type: keyof typeof DEVICE_WIDTH_CONFIG,
): void {
    const config = DEVICE_WIDTH_CONFIG[type];
    previewElement.style.width = config.width;
    previewElement.style.padding = config.padding;
}

/** 同步当前设备按钮高亮 */
function syncDeviceActionState(
    actionElement: HTMLElement,
    type: keyof typeof DEVICE_WIDTH_CONFIG,
): void {
    const buttons = actionElement.querySelectorAll<HTMLButtonElement>('button[data-group="device"]');
    for (const button of buttons) {
        button.classList.toggle("protyle-preview__action--current", button.getAttribute("data-type") === type);
    }
}

/** 同步图片预览按钮高亮 */
function syncPreviewTypeActionState(
    actionElement: HTMLElement,
    previewType: TExportPreviewType,
): void {
    const buttons = actionElement.querySelectorAll<HTMLButtonElement>('button[data-group="preview-type"]');
    for (const button of buttons) {
        button.classList.toggle("protyle-preview__action--current", button.getAttribute("data-type") === previewType);
    }
}

/** 准备普通导出预览区域 */
function prepareStandardPreviewArea(previewElement: HTMLElement): void {
    previewElement.classList.add("b3-typography");
    previewElement.style.overflow = "auto";
}

/** 准备图片导出预览区域 */
function prepareImagePreviewArea(previewElement: HTMLElement): void {
    previewElement.classList.remove("b3-typography");
    previewElement.style.overflow = "hidden";
    previewElement.innerHTML = "";
}

/** 根据当前预览类型渲染对应内容 */
async function renderByPreviewType(
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): Promise<void> {
    syncPreviewTypeActionState(actionElement, state.previewType);
    if (state.previewType === EXPORT_PREVIEW_IMAGE_TYPE) {
        await renderImagePreview(container, actionElement, previewElement, data, state);
        return;
    }
    await renderStandardPreview(container, previewElement, data.blockId, state);
}

/** 切换导出预览类型 */
async function setPreviewType(
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
    previewType: TExportPreviewType,
): Promise<void> {
    state.previewType = previewType;
    await renderByPreviewType(container, actionElement, previewElement, data, state);
}

/** 处理外部切换预览类型事件 */
async function handlePreviewTypeEvent(
    event: Event,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): Promise<void> {
    const customEvent = event as CustomEvent<{ previewType?: TExportPreviewType }>;
    const nextType = customEvent.detail?.previewType === EXPORT_PREVIEW_IMAGE_TYPE
        ? EXPORT_PREVIEW_IMAGE_TYPE
        : EXPORT_PREVIEW_DEFAULT_TYPE;
    await setPreviewType(previewElement.parentElement || previewElement, actionElement, previewElement, data, state, nextType);
}

/**
 * 操作按钮点击处理
 *
 * 处理设备宽度切换、图片导出预览切换与复制到第三方平台
 */
async function handleActionClick(
    event: Event,
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): Promise<void> {
    const eventTarget = event.target;
    if (!isHTMLElement(eventTarget)) {
        return;
    }
    const target = eventTarget.closest("button");
    if (!target) {
        return;
    }
    const type = target.getAttribute("data-type");
    if (!type) {
        return;
    }

    if (type === "mp-wechat" || type === "zhihu" || type === "yuque") {
        if (state.previewType === EXPORT_PREVIEW_IMAGE_TYPE) {
            await setPreviewType(container, actionElement, previewElement, data, state, EXPORT_PREVIEW_DEFAULT_TYPE);
        }
        executeCopyToX(container, previewElement, data.blockId, type);
        return;
    }

    if (type === EXPORT_PREVIEW_IMAGE_TYPE) {
        await setPreviewType(container, actionElement, previewElement, data, state, EXPORT_PREVIEW_IMAGE_TYPE);
        return;
    }

    if (!(type in DEVICE_WIDTH_CONFIG)) {
        return;
    }

    state.deviceType = type as keyof typeof DEVICE_WIDTH_CONFIG;
    applyDevicePreset(previewElement, state.deviceType);
    syncDeviceActionState(actionElement, state.deviceType);
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
    if (!(event instanceof MouseEvent)) {
        return;
    }
    let target = event.target;

    while (isHTMLElement(target) && target !== container) {
        if (target.tagName === "A") {
            handleLinkClick(event, target, previewElement, data, model);
            return;
        }
        if (target.tagName === "IMG") {
            previewDocImage(target.getAttribute("src") || "", data.blockId);
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        target = target.parentElement;
    }

    const eventTarget = event.target;
    if (!isHTMLElement(eventTarget)) {
        return;
    }
    const nodeElement = hasClosestByAttribute(eventTarget, "id", null);
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

    if (isMobile()) {
        openByMobile(linkAddress);
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    event.stopPropagation();
    event.preventDefault();

    if (isLocalPath(linkAddress)) {
        handleLocalPathOpen(event, linkAddress, model);
        return;
    }

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
    if (isOnlyMeta(event)) {
        openBy(linkAddress, "folder");
        return;
    }
    if (event.shiftKey) {
        openBy(linkAddress, "app");
        return;
    }
    const ext = pathPosix().extname(linkAddress.split("?")[0] || "");
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

    if (!isMobile()) {
        for (const item of getAllModels().outline) {
            if (item.blockId === blockId) {
                item.setCurrentByPreview(nodeElement);
            }
        }
        return;
    }

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
    if (!isHTMLElement(copyElement)) {
        return;
    }
    copyPreviewHTMLToX(container, copyElement, blockId, type);
}

/**
 * 处理普通导出预览 API 响应
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
    contentRendererRegistry.renderBatch(previewElement);
    highlightRender(previewElement);
    const lang = getSafeSiyuanConfig()?.appearance?.lang || "zh_CN";
    speechRender(previewElement, lang);
    previewElement.scrollTop = oldScrollTop;
    const loadingEl = container.querySelector(".fn__loading");
    loadingEl?.remove();
}

/** 调用普通导出预览 API 并渲染 */
function renderStandardPreview(
    container: HTMLElement,
    previewElement: HTMLElement,
    blockId: string,
    state: IExportPreviewViewState,
): Promise<void> {
    const renderToken = ++state.renderToken;
    prepareStandardPreviewArea(previewElement);
    previewElement.innerHTML = "";
    const loadingEl = container.querySelector(".fn__loading");
    loadingEl?.remove();
    container.insertAdjacentHTML("beforeend",
        `<div style="flex-direction: column;" class="fn__loading">
    <img width="48px" src="/stage/loading-pure.svg">
</div>`
    );

    return new Promise<void>((resolve) => {
        fetchPost("/api/export/preview", { id: blockId }, (response) => {
            if (renderToken !== state.renderToken || state.previewType !== EXPORT_PREVIEW_DEFAULT_TYPE) {
                resolve();
                return;
            }
            applyPreviewResponse(previewElement, container, response);
            resolve();
        });
    });
}

/** 渲染图片导出预览 panel */
async function renderImagePreview(
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): Promise<void> {
    const renderToken = ++state.renderToken;
    prepareImagePreviewArea(previewElement);
    container.querySelector(".fn__loading")?.remove();
    const ctx = await createExportImageTabContext(data.blockId, previewElement, {
        onCancel: () => {
            void setPreviewType(container, actionElement, previewElement, data, state, EXPORT_PREVIEW_DEFAULT_TYPE);
        },
        onExported: () => {
            syncPreviewTypeActionState(actionElement, state.previewType);
        },
    });
    if (!ctx || renderToken !== state.renderToken || state.previewType !== EXPORT_PREVIEW_IMAGE_TYPE) {
        return;
    }
    await initializeExportImagePanel(ctx);
}
