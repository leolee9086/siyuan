/** 用途：读取全局配置；使用范围：构建导出图片 panel 时决定书签图标样式；解耦评估：通过 environment 层访问配置，适合在共享 panel 中复用。 */
import {getSafeSiyuanConfig} from "./imports";
/** 用途：移动端判断；使用范围：共享 panel 在 dialog/tab 中复用时调整布局；解耦评估：平台工具函数直接复用即可。 */
import {isMobile} from "./imports";
/** 用途：展示错误消息；使用范围：共享 panel 缺失关键 DOM 时统一告警；解耦评估：UI 基础能力直接调用最简洁。 */
import {showMessage} from "./imports";
/** 用途：国际化文案；使用范围：构建共享 panel 的按钮和标签文本；解耦评估：全局 i18n 服务直接使用符合现有架构。 */
import {siyuanI18n} from "./imports";
/** 用途：导出比例选项 HTML；使用范围：共享 panel 的比例下拉框渲染；解耦评估：比例配置集中维护优于重复硬编码。 */
import {buildExportImageRatioOptionsHtml} from "./exportImage.ratio";
/** 用途：导出图片上下文与配置类型；使用范围：共享 panel 创建上下文时的类型约束；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";
/** 用途：导出图片面板回调类型；使用范围：注入宿主特定的取消/完成行为；解耦评估：通过回调实现宿主解耦。 */
import type {IExportImagePanelCallbacks} from "./exportImage.types";
/** 用途：导出图片面板模式类型；使用范围：区分 dialog/tab 两种宿主；解耦评估：字面量联合类型足够轻量。 */
import type {TExportImagePanelMode} from "./exportImage.types";
/** 用途：导出图片配置类型；使用范围：构建共享 panel HTML；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageStorage} from "./exportImage.types";

/** 用途：tab 模式下的固定导出画布边框盒宽度；使用范围：让比例预览与最终导出都不受 tab 宽度波动影响。 */
const EXPORT_IMAGE_TAB_FRAME_WIDTH = 960;
/** 用途：tab 模式下内容区左右边距；使用范围：为固定画布预览预留可见边距，同时参与宽度计算。 */
const EXPORT_IMAGE_TAB_CONTENT_PADDING_X = 24;
/** 用途：tab 模式下内容区上下边距；使用范围：保持 tab 预览与 dialog 预览的留白体验一致。 */
const EXPORT_IMAGE_TAB_CONTENT_PADDING_Y = 16;
/** 用途：导出图片背景按钮文案；使用范围：在导出图片界面明确表达为“背景图”。 */
const EXPORT_IMAGE_BACKGROUND_LABEL = "添加背景图";

/** 作用：生成共享的导出图片 panel HTML。意图：让同一套界面能在 dialog 与 tab 两种宿主中复用。调用时机：创建导出图片上下文前。 */
export const buildExportImagePanelHtml = async (
    storage: IExportImageStorage,
    mode: TExportImagePanelMode,
): Promise<string> => {
    const displayBookmarkIcon = getSafeSiyuanConfig()?.editor?.displayBookmarkIcon ?? false;
    const previewClassName = `protyle-wysiwyg${displayBookmarkIcon ? " protyle-wysiwyg--attr" : ""}`;
    const ratioOptionsHtml = await buildExportImageRatioOptionsHtml(storage.ratio);
    const contentStyle = `${isMobile() ? "padding:8px;" : ""};background-color: var(--b3-theme-background)${mode === "tab" ? `;flex:1;overflow:auto;padding:${EXPORT_IMAGE_TAB_CONTENT_PADDING_Y}px ${EXPORT_IMAGE_TAB_CONTENT_PADDING_X}px;display:flex;justify-content:center;align-items:flex-start;` : ""}`;
    const exportImageStyle = `${isMobile() ? "margin: 8px 0" : "padding: 48px;margin: 8px 0"}${mode === "tab" ? `;width:${EXPORT_IMAGE_TAB_FRAME_WIDTH}px;max-width:${EXPORT_IMAGE_TAB_FRAME_WIDTH}px;min-width:${EXPORT_IMAGE_TAB_FRAME_WIDTH}px;box-sizing:border-box;margin:0;` : ""}`;
    const panelContent = `<div class="b3-dialog__content" style="${contentStyle}">
    <div style="${exportImageStyle}" class="export-img">
        <div ${isMobile() ? 'style="padding:8px"' : ""} class="${previewClassName}"></div>
        <div class="export-img__watermark"></div>
    </div>
</div>
<div class="b3-dialog__action"${mode === "tab" ? ' style="flex-wrap: wrap; row-gap: 8px;"' : ""}>
    <label class="fn__flex">
        ${siyuanI18n.exportPDF5}
        <span class="fn__space"></span>
        <input id="keepFold" class="b3-switch fn__flex-center" type="checkbox" ${storage.keepFold ? "checked" : ""}>
    </label>
    <label class="fn__flex" style="margin-left: 24px">
        ${siyuanI18n.export30}
        <span class="fn__space"></span>
        <input id="watermark" class="b3-switch fn__flex-center" type="checkbox" ${storage.watermark ? "checked" : ""}>
    </label>
    <div class="fn__space"></div>
    <button id="backgroundButton" type="button" class="b3-button b3-button--cancel export-img__background-trigger">
        <span class="export-img__background-preview export-img__background-preview--empty"></span>
        ${EXPORT_IMAGE_BACKGROUND_LABEL}
    </button>
    <input id="backgroundUpload" class="fn__none" type="file" accept="image/*">
    <div class="fn__space"></div>
    <button id="clearBackgroundButton" type="button" class="b3-button b3-button--cancel ariaLabel" aria-label="${siyuanI18n.remove}" title="${siyuanI18n.remove}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </button>
    <span class="fn__flex-1 export-img__space"></span>
    <select id="ratio" class="b3-select fn__flex-center fn__size200" aria-label="导出比例" title="导出比例">
        ${ratioOptionsHtml}
    </select>
    <div class="fn__space"></div>
    <button id="exportImageCancel" disabled class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button id="exportImageConfirm" disabled class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>
<div class="fn__loading"><img height="128px" width="128px" src="stage/loading-pure.svg"></div>`;

    if (mode === "dialog") {
        return panelContent;
    }

    return `<div class="b3-dialog__container export-img-panel" style="display:flex;flex-direction:column;height:100%;min-height:0;width:max-content;min-width:100%;max-width:none;margin:0 auto;opacity:1;transform:none;box-shadow:none;border:none;border-radius:0;background-color:var(--b3-theme-background);flex-grow:1;flex-shrink:1;">
    ${panelContent}
</div>`;
};

/** 作用：从宿主根节点解析共享 panel 的关键 DOM。意图：避免 dialog/tab 两套选择器解析逻辑分叉。调用时机：panel HTML 已注入后。 */
export const createExportImagePanelContext = (
    id: string,
    rootElement: HTMLElement,
    storage: IExportImageStorage,
    mode: TExportImagePanelMode,
    callbacks?: IExportImagePanelCallbacks,
): IExportImageContext | undefined => {
    const containerElement = rootElement.querySelector<HTMLElement>(".b3-dialog__container") || rootElement;
    const previewElement = containerElement.querySelector<HTMLElement>(".protyle-wysiwyg");
    const contentElement = containerElement.querySelector<HTMLElement>(".b3-dialog__content");
    const exportImageElement = containerElement.querySelector<HTMLElement>(".export-img");
    const watermarkPreviewElement = containerElement.querySelector<HTMLElement>(".export-img__watermark");
    const keepFoldElement = containerElement.querySelector<HTMLInputElement>("#keepFold");
    const watermarkElement = containerElement.querySelector<HTMLInputElement>("#watermark");
    const backgroundButton = containerElement.querySelector<HTMLButtonElement>("#backgroundButton");
    const backgroundPreviewElement = containerElement.querySelector<HTMLElement>(".export-img__background-preview");
    const backgroundUploadInputElement = containerElement.querySelector<HTMLInputElement>("#backgroundUpload");
    const clearBackgroundButton = containerElement.querySelector<HTMLButtonElement>("#clearBackgroundButton");
    const ratioElement = containerElement.querySelector<HTMLSelectElement>("#ratio");
    const cancelButton = containerElement.querySelector<HTMLButtonElement>("#exportImageCancel");
    const confirmButton = containerElement.querySelector<HTMLButtonElement>("#exportImageConfirm");

    // 关键节点缺失时共享 panel 无法安全工作，必须中止并统一报错。
    if (!previewElement || !contentElement || !exportImageElement || !watermarkPreviewElement || !keepFoldElement || !watermarkElement || !backgroundButton || !backgroundPreviewElement || !backgroundUploadInputElement || !clearBackgroundButton || !ratioElement || !cancelButton || !confirmButton) {
        showMessage(siyuanI18n._kernel[14], 3000, "error");
        return;
    }

    return {
        id,
        rootElement: containerElement,
        mode,
        cancel: callbacks?.onCancel || (() => {}),
        finish: callbacks?.onExported || (() => {}),
        storage,
        previewElement,
        contentElement,
        containerElement,
        exportImageElement,
        watermarkPreviewElement,
        keepFoldElement,
        watermarkElement,
        backgroundButton,
        backgroundPreviewElement,
        backgroundUploadInputElement,
        clearBackgroundButton,
        ratioElement,
        cancelButton,
        confirmButton,
    };
};
