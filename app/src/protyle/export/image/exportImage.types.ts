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
    background: string;
}

/**
 * 用途：导出图片面板的宿主模式。
 * 使用场景：区分当前面板挂载在 dialog 还是 tab 中，以便复用同一套界面结构。
 * 关联模块：`exportImage.panel.ts`。
 */
export type TExportImagePanelMode = "dialog" | "tab";

/**
 * 用途：导出图片面板宿主回调。
 * 使用场景：让共享 panel 在不同宿主下执行不同的取消/完成行为，同时保持实现兼容。
 * 关联模块：`exportImage.helpers.ts`、`exportImage.confirm.ts`。
 */
export interface IExportImagePanelCallbacks {
    onCancel?: () => void;
    onExported?: () => void;
}

/**
 * 用途：导出图片对话框的运行时上下文。
 * 使用场景：在预览刷新、水印更新、最终导出流程中共享 DOM 与状态。
 * 关联类型：依赖 `IExportImageStorage` 保存用户开关配置。
 * 问题/改进：字段较多，后续可按“DOM引用/业务状态”继续拆分子结构。
 */
export interface IExportImageContext {
    id: string;
    rootElement: HTMLElement;
    mode: TExportImagePanelMode;
    cancel: () => void;
    finish: () => void;
    storage: IExportImageStorage;
    previewElement: HTMLElement;
    contentElement: HTMLElement;
    containerElement: HTMLElement;
    exportImageElement: HTMLElement;
    watermarkPreviewElement: HTMLElement;
    keepFoldElement: HTMLInputElement;
    watermarkElement: HTMLInputElement;
    backgroundButton: HTMLButtonElement;
    backgroundPreviewElement: HTMLElement;
    backgroundUploadInputElement: HTMLInputElement;
    clearBackgroundButton: HTMLButtonElement;
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
 * 用途：表示 html-to-image 最小运行时与本次导出选项的组合。
 * 使用场景：比例分页导出时仅依赖 `toBlob` 和图片错误选项完成截图。
 * 关联模块：导出确认流程创建该对象，再注入比例模块。
 * 问题/改进：若未来切换截图实现，可继续维持该最小结构解耦。
 */
export interface IExportImageCapture {
    runtime: {
        toBlob: (element: Element, options: IExportImageCapture["options"]) => Promise<Blob | null | undefined>;
    };
    options: {
        imagePlaceholder: string;
        onImageErrorHandler: (event: Event) => void;
    };
}
