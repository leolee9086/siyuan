/** 用途：描述带本地路径的浏览器文件；使用场景：拖入目录时转交 Protyle 领域根处理。 */
export interface UploadFileWithPath extends File {
    path: string;
}

/**
 * 用途：描述一次 XHR 上传从请求到完成所需的完整上下文。
 * 使用场景：状态回调、成功分派、输入清理和进度生命周期共享同一请求身份。
 * 关联类型：`IProtyle` 提供上传配置与完整领域根，`File[]` 是应用 file hook 后的原始响应格式上下文。
 */
export interface UploadRequestContext {
    protyle: IProtyle;
    msgId: string;
    editorElement: HTMLElement;
    fileList: File[];
    element?: HTMLInputElement;
    successCB?: (responseText: string) => void;
}
