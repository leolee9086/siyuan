/**
 * Upload class 的完整公共领域表面。
 * 上传传输和编辑器状态只依赖进度元素与进行中状态，具体构造器仅由 Protyle 组合根加载。
 */
export interface UploadDomain {
    element: HTMLElement;
    isUploading: boolean;
}
