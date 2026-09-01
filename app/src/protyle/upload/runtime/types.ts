/**
 * 用途：描述上传插入位置、命令和运行时端口能力。
 * 使用场景：编辑器、粘贴、AV 资产和 base64 转换共享上传协议而不反向加载上传组合根。
 * 关联类型：IUploadInsertPosition、IAssetUploadResult、ILocalFiles。
 * 问题/改进：端口只承载现有命令签名，具体上传状态和 UI 生命周期仍由 upload/index.ts 所有。
 */
import type {IUploadInsertPosition} from "../insertPosition";

/** 上传命令用于保留焦点、插件上下文和目标消费语义的可选参数。 */
export interface IUploadInsertOptions {
    htmlAsIframe?: boolean;
    insertPosition?: IUploadInsertPosition;
    source?: TAssetUploadSource;
    target?: TAssetUploadTarget;
    position?: IAssetUploadPosition;
    /** 目标消费方要求的文件数量。 */
    requiredFileCount?: number;
    /** 目标消费方支持的输入类型。 */
    allowedInputKinds?: Array<IAssetUploadInput["kind"]>;
    /** 本机 HTML 粘贴需要沿用内核的敏感路径校验。 */
    fromHTMLPaste?: boolean;
}

/** 通过完整上传任务管线上传浏览器 File 输入。 */
export type TUploadFiles = (
    protyle: IProtyle,
    files: FileList | DataTransferItemList | File[],
    element?: HTMLInputElement,
    successCB?: (
        responseText: string,
        result: Omit<IAssetUploadResult, "requestId" | "input">,
    ) => void,
    completeCB?: (succeeded: boolean) => void,
    options?: IUploadInsertOptions,
) => void;

/** 通过完整上传任务管线上传本地路径输入。 */
export type TUploadLocalFiles = (
    files: string[] | ILocalFiles[],
    protyle: IProtyle,
    isUpload: boolean,
    options?: IUploadInsertOptions,
    successCB?: (
        response: IWebSocketData,
        result: Omit<IAssetUploadResult, "requestId" | "input">,
    ) => void,
    completeCB?: (succeeded: boolean) => void,
) => void;

/** 已装配上传组合根向低层编辑模块发布的命令能力。 */
export interface IUploadRuntimeEffects {
    uploadFiles: TUploadFiles;
    uploadLocalFiles: TUploadLocalFiles;
}
