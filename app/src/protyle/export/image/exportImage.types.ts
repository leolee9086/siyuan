/** 用途：Dialog 类型；使用范围：导出图片上下文中的 `dialog` 字段；解耦评估：仅用于类型标注，通过 imports 网关降低路径耦合。 */
import type {Dialog} from "./imports";

/**
 * 用途：导出图片开关配置的数据结构。
 * 使用场景：读取/更新 `Constants.LOCAL_EXPORTIMG` 本地存储时使用。
 * 关联类型：`IExportImageContext` 会持有该结构以驱动 UI 状态。
 * 问题/改进：目前仅包含 keepFold/watermark，若后续加入导出比例等选项需同步扩展。
 */
export interface IExportImageStorage {
    keepFold: boolean;
    watermark: boolean;
}

/**
 * 用途：导出图片对话框的运行时上下文。
 * 使用场景：在预览刷新、水印更新、最终导出流程中共享 DOM 与状态。
 * 关联类型：依赖 `IExportImageStorage` 保存用户开关配置。
 * 问题/改进：字段较多，后续可按“DOM引用/业务状态”继续拆分子结构。
 */
export interface IExportImageContext {
    id: string;
    dialog: Dialog;
    storage: IExportImageStorage;
    previewElement: HTMLElement;
    contentElement: HTMLElement;
    containerElement: HTMLElement;
    exportImageElement: HTMLElement;
    watermarkPreviewElement: HTMLElement;
    keepFoldElement: HTMLInputElement;
    watermarkElement: HTMLInputElement;
    cancelButton: HTMLButtonElement;
    confirmButton: HTMLButtonElement;
}
