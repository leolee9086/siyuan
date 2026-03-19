/** 用途：Dialog 类型；使用范围：导出图片上下文中的 `dialog` 字段；解耦评估：仅用于类型标注，通过 imports 网关降低路径耦合。 */
import type {Dialog} from "./imports";

/**
 * 用途：导出图片开关配置的数据结构。
 * 使用场景：读取/更新 `Constants.LOCAL_EXPORTIMG` 本地存储时使用。
 * 关联类型：`IExportImageContext` 会持有该结构以驱动 UI 状态。
 * 问题/改进：后续若加入“按分割线/按标题”等导出模式，可继续在此扩展。
 */
export interface IExportImageStorage {
    keepFold: boolean;
    watermark: boolean;
    ratio: string;
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
    ratioElement: HTMLSelectElement;
    cancelButton: HTMLButtonElement;
    confirmButton: HTMLButtonElement;
}

/**
 * 用途：导出图片比例选项的数据结构。
 * 使用场景：约束比例下拉选项列表中的 value 与 label 字段。
 * 关联模块：`exportImage.ratio.ts` 中的比例常量与模板构建逻辑。
 * 问题/改进：后续若需支持图标或分组显示，可继续扩展附加字段。
 */
export interface IExportImageRatioOption {
    value: string;
    label: string;
}

/**
 * 用途：导出图片文件描述。
 * 使用场景：按比例分页截图后返回多张图片及各自文件名。
 * 关联函数：`exportImageBlobsByRatio`。
 * 问题/改进：当前仅关注 Blob 与文件名，后续可扩展 MIME 与尺寸信息。
 */
export interface IExportImageBlobFile {
    blob: Blob;
    fileName: string;
}

/**
 * 用途：html-to-image 最小能力约束。
 * 使用场景：比例分页导出时仅依赖 `toBlob` 能力完成截图。
 * 关联模块：导出确认流程会把运行时 html-to-image 对象注入到比例模块。
 * 问题/改进：若未来切换截图实现，可继续维持最小接口解耦。
 */
export interface IExportImageBlobGenerator {
    toBlob: (element: Element) => Promise<Blob | null | undefined>;
}
