/** 富文本剪贴板图片来源的 DOM 与资源映射。 */
export interface IRichClipboardSource {
    element: HTMLImageElement;
    index: number;
    path: string;
    box: string;
}

/** 内核为富文本剪贴板准备的批次与资源映射。 */
export interface IRichClipboardPrepared {
    batch: string;
    groups: string[];
    assets: Array<{
        index: number;
        path: string;
    }>;
}

/** 可由调用方控制的富文本剪贴板增强选项。 */
export interface IRichClipboardOptions {
    marker?: string;
    removeMarker?: boolean;
}
