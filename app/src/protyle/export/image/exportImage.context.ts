/** 用途：对话框组件；使用范围：构建导出图片弹窗实例；解耦评估：UI 基础组件，不适合在业务层重复实现。 */
import {Dialog} from "./imports";
/** 用途：导出流程常量；使用范围：设置弹窗 data-key；解耦评估：集中常量依赖，禁止硬编码替代。 */
import {Constants} from "./imports";
/** 用途：读取全局配置；使用范围：控制预览区书签图标显示；解耦评估：通过 environment 层访问，已与 window 解耦。 */
import {getSiyuanConfig} from "./imports";
/** 用途：移动端判断；使用范围：弹窗布局与样式分支；解耦评估：平台工具函数复用即可。 */
import {isMobile} from "./imports";
/** 用途：展示错误消息；使用范围：关键 DOM 缺失时告警；解耦评估：UI 基础能力，直接调用成本最低。 */
import {showMessage} from "./imports";
/** 用途：国际化文案；使用范围：弹窗标题与文案内容；解耦评估：全局 i18n 服务直接依赖符合项目约定。 */
import {siyuanI18n} from "./imports";
/** 用途：导出图片配置读取；使用范围：初始化 keepFold/watermark 默认状态；解耦评估：配置读取职责已独立模块化。 */
import {getExportImageStorage} from "./exportImage.storage";
/** 用途：导出图片上下文类型；使用范围：上下文创建返回值约束；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";
/** 用途：导出图片存储类型；使用范围：模板构建参数；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageStorage} from "./exportImage.types";

/** 作用：构建导出图片弹窗 HTML；意图：将模板拼装从流程中剥离；调用时机：创建 Dialog 时；问题/改进：后续可改为组件模板。 */
const buildDialogContent = (storage: IExportImageStorage): string => {
    const displayBookmarkIcon = getSiyuanConfig()?.editor?.displayBookmarkIcon ?? false;
    const previewClassName = `protyle-wysiwyg${displayBookmarkIcon ? " protyle-wysiwyg--attr" : ""}`;
    return `<div class="b3-dialog__content" style="${isMobile() ? "padding:8px;" : ""};background-color: var(--b3-theme-background)">
    <div style="${isMobile() ? "margin: 8px 0" : "padding: 48px;margin: 8px 0"}" class="export-img">
        <div ${isMobile() ? 'style="padding:8px"' : ""} class="${previewClassName}"></div>
        <div class="export-img__watermark"></div>
    </div>
</div>
<div class="b3-dialog__action">
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
    <span class="fn__flex-1 export-img__space"></span>
    <button disabled class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button disabled class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>
<div class="fn__loading"><img height="128px" width="128px" src="stage/loading-pure.svg"></div>`;
};

/**
 * 作用：创建并校验导出图片流程所需上下文。
 * 意图：在流程入口阶段一次性完成 DOM 依赖校验，降低后续空值分支复杂度。
 * 调用时机：导出图片流程启动时。
 * 问题/改进：依赖模板选择器，模板调整时需同步维护。
 */
// 导出语句注释：导出图片上下文创建入口。
export const createExportImageContext = async (id: string, dialogKey: string): Promise<IExportImageContext | undefined> => {
    const storage = await getExportImageStorage();
    const dialog = new Dialog({
        title: siyuanI18n.exportAsImage,
        content: buildDialogContent(storage),
        width: isMobile() ? "92vw" : "990px",
        height: "70vh"
    });
    dialog.element.setAttribute("data-key", dialogKey || Constants.DIALOG_EXPORTIMAGE);

    const previewElement = dialog.element.querySelector<HTMLElement>(".protyle-wysiwyg");
    const contentElement = dialog.element.querySelector<HTMLElement>(".b3-dialog__content");
    const containerElement = dialog.element.querySelector<HTMLElement>(".b3-dialog__container");
    const exportImageElement = dialog.element.querySelector<HTMLElement>(".export-img");
    const watermarkPreviewElement = dialog.element.querySelector<HTMLElement>(".export-img__watermark");
    const keepFoldElement = dialog.element.querySelector<HTMLInputElement>("#keepFold");
    const watermarkElement = dialog.element.querySelector<HTMLInputElement>("#watermark");
    const buttons = dialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
    const cancelButton = buttons.item(0);
    const confirmButton = buttons.item(1);

    // 关键节点缺失时流程无法安全继续，必须中止并提示失败。
    if (!previewElement || !contentElement || !containerElement || !exportImageElement || !watermarkPreviewElement || !keepFoldElement || !watermarkElement || !cancelButton || !confirmButton) {
        dialog.destroy();
        showMessage(siyuanI18n._kernel[14], 3000, "error");
        return;
    }

    return {
        id,
        dialog,
        storage,
        previewElement,
        contentElement,
        containerElement,
        exportImageElement,
        watermarkPreviewElement,
        keepFoldElement,
        watermarkElement,
        cancelButton,
        confirmButton,
    };
};
