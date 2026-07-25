/**
 * 导出预览页签初始化
 *
 * 作用：作为 TabRegistry 的 init 回调，构建导出预览页签的 DOM 和交互逻辑
 * 意图：将普通导出预览、第三方平台预览与图片导出预览统一挂载到同一个页签宿主中
 * 调用时机：通过 openFile({ custom: { id: 'export-preview', data: { blockId } } }) 打开时
 */

import type {CustomDomain} from "../layout/dock/custom/custom.types";
import { Model } from "../layout/Model";
import { genUUID } from "../util/platform/genID";
import { fetchPost } from "../util/network/fetch";
import { contentRendererRegistry } from "../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "../protyle/render/highlightRender";
import { speechRender } from "../protyle/render/speechRender";
import { previewDocImage } from "../protyle/preview/image";
import {
    copyPreviewHTMLToX,
    preparePreviewHTMLForX,
    requestYuqueMarkdown,
} from "../protyle/preview/copyToX";
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
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { isExportPreviewData } from "./init.guard";
import {
    DEFAULT_ACTIONS,
    EXPORT_PREVIEW_DEFAULT_TYPE,
    EXPORT_PREVIEW_IMAGE_TYPE,
    EXPORT_PREVIEW_MP_WECHAT_TYPE,
    EXPORT_PREVIEW_PLATFORM_TYPES,
    EXPORT_PREVIEW_SET_TYPE_EVENT,
    EXPORT_PREVIEW_YUQUE_TYPE,
    EXPORT_PREVIEW_ZHIHU_TYPE,
} from "./constants";
import type { TCopyTargetPlatform } from "../protyle/preview/copyToX";
import type { IExportPreviewData, TExportPreviewType } from "./init.types";

/** 设备宽度预设配置 */
const DEVICE_WIDTH_CONFIG: Record<string, { width: string; padding: string }> = {
    desktop: { width: "", padding: "" },
    tablet: { width: "1024px", padding: "8px 16px" },
    mobile: { width: "360px", padding: "8px" },
};

const BACKEND_REFRESH_DEBOUNCE_MS = 300;
const PLATFORM_COPY_BUTTON_TYPE = "export-preview:copy-platform";

type TPlatformPreviewType = typeof EXPORT_PREVIEW_PLATFORM_TYPES[number];

const isPlatformPreviewType = (previewType: string): previewType is TPlatformPreviewType => {
    return (EXPORT_PREVIEW_PLATFORM_TYPES as readonly string[]).includes(previewType);
};

const isSupportedPreviewType = (previewType: unknown): previewType is TExportPreviewType => {
    if (typeof previewType !== "string") {
        return false;
    }
    return previewType === EXPORT_PREVIEW_DEFAULT_TYPE ||
        previewType === EXPORT_PREVIEW_IMAGE_TYPE ||
        isPlatformPreviewType(previewType);
};

const getPlatformCopyLabel = (previewType: TPlatformPreviewType): string => {
    if (previewType === EXPORT_PREVIEW_MP_WECHAT_TYPE) {
        return siyuanI18n.copyToWechatMP;
    }
    if (previewType === EXPORT_PREVIEW_ZHIHU_TYPE) {
        return siyuanI18n.copyToZhihu;
    }
    return siyuanI18n.copyToYuque;
};

interface IExportPreviewViewState {
    deviceType: keyof typeof DEVICE_WIDTH_CONFIG;
    previewType: TExportPreviewType;
    renderToken: number;
    backendRefreshTimer?: number;
    syncModel?: Model;
}

/**
 * 导出预览页签 init 回调
 *
 * 作用：构建页签 DOM、绑定事件、发起渲染请求
 * @同步豁免: UI构建 - TabRegistry init 回调需要同步构建 DOM 结构
 */
export function initExportPreview(model: CustomDomain): void {
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
        handleContentClick(event, container, previewElement, data, model, state);
    });

    container.addEventListener(EXPORT_PREVIEW_SET_TYPE_EVENT, (event) => {
        void handlePreviewTypeEvent(event, actionElement, previewElement, data, state);
    });

    bindBackendEditSync(model, container, actionElement, previewElement, data, state);
    void renderByPreviewType(container, actionElement, previewElement, data, state);
}

/** 绑定后端编辑事件监听，自动刷新导出预览内容 */
function bindBackendEditSync(
    model: CustomDomain,
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): void {
    const syncModel = new Model({
        app: model.app,
        id: genUUID(),
        msgCallback: (eventData) => {
            if (!shouldRefreshByBackendEvent(eventData, data.blockId)) {
                return;
            }
            scheduleBackendRefresh(container, actionElement, previewElement, data, state);
        },
    });
    state.syncModel = syncModel;

    const previousDestroy = model.destroy;
    model.destroy = () => {
        if (typeof state.backendRefreshTimer === "number") {
            window.clearTimeout(state.backendRefreshTimer);
            state.backendRefreshTimer = undefined;
        }
        state.syncModel?.send("closews", {});
        state.syncModel = undefined;
        previousDestroy?.();
    };
}

/** 判断后端消息是否需要触发当前导出预览刷新 */
function shouldRefreshByBackendEvent(
    eventData: IWebSocketData,
    blockId: string,
): boolean {
    if (eventData.cmd === "savedoc") {
        return eventData.data?.rootID === blockId;
    }
    if (eventData.cmd === "reload") {
        return eventData.data === blockId;
    }
    return false;
}

/** 对后端刷新进行防抖，避免连续编辑期间高频请求 */
function scheduleBackendRefresh(
    container: HTMLElement,
    actionElement: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    state: IExportPreviewViewState,
): void {
    if (typeof state.backendRefreshTimer === "number") {
        window.clearTimeout(state.backendRefreshTimer);
    }
    state.backendRefreshTimer = window.setTimeout(() => {
        state.backendRefreshTimer = undefined;
        if (!container.isConnected) {
            return;
        }
        void renderByPreviewType(container, actionElement, previewElement, data, state);
    }, BACKEND_REFRESH_DEBOUNCE_MS);
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

/** 同步预览类型按钮高亮 */
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

/** 准备第三方平台预览区域 */
function preparePlatformPreviewArea(previewElement: HTMLElement): void {
    previewElement.classList.remove("b3-typography");
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
    if (isPlatformPreviewType(state.previewType)) {
        await renderPlatformPreview(container, previewElement, data.blockId, state, state.previewType);
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
    const requestedType = customEvent.detail?.previewType;
    const nextType = isSupportedPreviewType(requestedType) ? requestedType : EXPORT_PREVIEW_DEFAULT_TYPE;
    await setPreviewType(previewElement.parentElement || previewElement, actionElement, previewElement, data, state, nextType);
}

/**
 * 操作按钮点击处理
 *
 * 处理设备宽度切换、预览类型切换
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

    if (type === EXPORT_PREVIEW_IMAGE_TYPE) {
        await setPreviewType(container, actionElement, previewElement, data, state, EXPORT_PREVIEW_IMAGE_TYPE);
        return;
    }

    if (isPlatformPreviewType(type)) {
        const nextType = state.previewType === type ? EXPORT_PREVIEW_DEFAULT_TYPE : type;
        await setPreviewType(container, actionElement, previewElement, data, state, nextType);
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
 * 处理链接跳转、图片预览、大纲同步高亮与平台复制
 */
function handleContentClick(
    event: Event,
    container: HTMLElement,
    previewElement: HTMLElement,
    data: IExportPreviewData,
    model: CustomDomain,
    state: IExportPreviewViewState,
): void {
    if (!(event instanceof MouseEvent)) {
        return;
    }
    const eventTarget = event.target;
    if (!isHTMLElement(eventTarget)) {
        return;
    }

    const copyButton = eventTarget.closest<HTMLButtonElement>(`button[data-type="${PLATFORM_COPY_BUTTON_TYPE}"]`);
    if (copyButton && isPlatformPreviewType(state.previewType)) {
        const platformContent = previewElement.querySelector<HTMLElement>(".export-preview-platform__content");
        if (platformContent) {
            executeCopyToX(container, platformContent, data.blockId, state.previewType);
        }
        event.stopPropagation();
        event.preventDefault();
        return;
    }

    let target: HTMLElement | null = eventTarget;
    while (target && target !== container) {
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
    model: CustomDomain,
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
    model: CustomDomain,
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
    sourceElement: HTMLElement,
    blockId: string,
    type: TCopyTargetPlatform,
): void {
    const copyElement = sourceElement.cloneNode(true);
    if (!isHTMLElement(copyElement)) {
        return;
    }
    void copyPreviewHTMLToX(container, copyElement, blockId, type);
}

/** 渲染代码高亮/语音等预览后处理 */
function applyPreviewPostRender(previewElement: HTMLElement): void {
    contentRendererRegistry.renderBatch(previewElement);
    highlightRender(previewElement);
    const lang = getSafeSiyuanConfig()?.appearance?.lang || "zh_CN";
    speechRender(previewElement, lang);
}

/** 设置平台预览容器与复制按钮 */
function mountPlatformPreview(
    previewElement: HTMLElement,
    contentElement: HTMLElement,
    previewType: TPlatformPreviewType,
): void {
    const oldScrollTop = previewElement.scrollTop;
    previewElement.innerHTML = `<div class="fn__flex" style="position: sticky; top: 0; z-index: 1; padding: 8px 0; background: var(--b3-theme-background);">
    <span class="fn__flex-1"></span>
    <button type="button" class="b3-button b3-button--outline" data-type="${PLATFORM_COPY_BUTTON_TYPE}">${getPlatformCopyLabel(previewType)}</button>
</div>`;
    previewElement.appendChild(contentElement);
    previewElement.scrollTop = oldScrollTop;
}

/** 请求普通导出预览内容 */
function requestStandardPreview(blockId: string): Promise<IWebSocketData> {
    return new Promise((resolve) => {
        fetchPost("/api/export/preview", { id: blockId }, (response) => {
            resolve(response);
        });
    });
}

/** 显示加载中状态 */
function showLoading(container: HTMLElement): void {
    container.querySelector(".fn__loading")?.remove();
    container.insertAdjacentHTML("beforeend",
        `<div style="flex-direction: column;" class="fn__loading">
    <img width="48px" src="/stage/loading-pure.svg">
</div>`
    );
}

/** 清理加载中状态 */
function clearLoading(container: HTMLElement): void {
    container.querySelector(".fn__loading")?.remove();
}

/** 检查异步渲染是否仍然有效 */
function isRenderStillValid(
    state: IExportPreviewViewState,
    renderToken: number,
    expectedPreviewType: TExportPreviewType,
): boolean {
    return renderToken === state.renderToken && state.previewType === expectedPreviewType;
}

/** 调用普通导出预览 API 并渲染 */
async function renderStandardPreview(
    container: HTMLElement,
    previewElement: HTMLElement,
    blockId: string,
    state: IExportPreviewViewState,
): Promise<void> {
    const renderToken = ++state.renderToken;
    prepareStandardPreviewArea(previewElement);
    previewElement.innerHTML = "";
    showLoading(container);

    const response = await requestStandardPreview(blockId);
    if (!isRenderStillValid(state, renderToken, EXPORT_PREVIEW_DEFAULT_TYPE)) {
        return;
    }

    const oldScrollTop = previewElement.scrollTop;
    previewElement.innerHTML = response.data?.html || "";
    applyPreviewPostRender(previewElement);
    previewElement.scrollTop = oldScrollTop;
    clearLoading(container);
}

/** 渲染第三方平台预览 */
async function renderPlatformPreview(
    container: HTMLElement,
    previewElement: HTMLElement,
    blockId: string,
    state: IExportPreviewViewState,
    previewType: TPlatformPreviewType,
): Promise<void> {
    const renderToken = ++state.renderToken;
    preparePlatformPreviewArea(previewElement);
    previewElement.innerHTML = "";
    showLoading(container);

    if (previewType === EXPORT_PREVIEW_YUQUE_TYPE) {
        const markdown = await requestYuqueMarkdown(blockId);
        if (!isRenderStillValid(state, renderToken, previewType)) {
            return;
        }
        const contentElement = document.createElement("div");
        contentElement.className = "export-preview-platform__content";
        const preElement = document.createElement("pre");
        preElement.className = "b3-typography";
        preElement.style.margin = "0";
        preElement.style.whiteSpace = "pre-wrap";
        preElement.style.wordBreak = "break-word";
        preElement.textContent = markdown;
        contentElement.appendChild(preElement);
        mountPlatformPreview(previewElement, contentElement, previewType);
        clearLoading(container);
        return;
    }

    const response = await requestStandardPreview(blockId);
    if (!isRenderStillValid(state, renderToken, previewType)) {
        return;
    }

    const contentElement = document.createElement("div");
    contentElement.className = "export-preview-platform__content b3-typography";
    contentElement.innerHTML = response.data?.html || "";
    applyPreviewPostRender(contentElement);
    await preparePreviewHTMLForX(contentElement, previewType);
    if (!isRenderStillValid(state, renderToken, previewType)) {
        return;
    }

    mountPlatformPreview(previewElement, contentElement, previewType);
    clearLoading(container);
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
    clearLoading(container);
    const ctx = await createExportImageTabContext(data.blockId, previewElement, {
        onCancel: () => {
            void setPreviewType(container, actionElement, previewElement, data, state, EXPORT_PREVIEW_DEFAULT_TYPE);
        },
        onExported: () => {
            syncPreviewTypeActionState(actionElement, state.previewType);
        },
    });
    if (!ctx || !isRenderStillValid(state, renderToken, EXPORT_PREVIEW_IMAGE_TYPE)) {
        return;
    }
    await initializeExportImagePanel(ctx);
}
