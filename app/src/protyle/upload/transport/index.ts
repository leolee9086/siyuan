/** 用途：上传常量；使用范围：验证、表单和遗留地址；解耦评估：经专属网关直达声明。 */
import {Constants} from "./imports";
/** 用途：大文件确认；使用范围：发送门禁；解耦评估：经专属网关使用唯一 Dialog 实现。 */
import {confirmDialog} from "./imports";
/** 用途：编辑器销毁；使用范围：异步完成时宿主已脱离文档；解耦评估：经专属网关使用唯一生命周期实现。 */
import {destroy} from "./imports";
/** 用途：文件尺寸格式化；使用范围：大文件确认；解耦评估：经专属网关直达第三方实现。 */
import {filesize} from "./imports";
/** 用途：关闭进度消息；使用范围：成功完成；解耦评估：经专属网关使用唯一 Dialog 实现。 */
import {hideMessage} from "./imports";
/** 用途：展示进度与错误；使用范围：完整传输生命周期；解耦评估：经专属网关使用唯一 Dialog 实现。 */
import {showMessage} from "./imports";
/** 用途：编码文件名；使用范围：验证、进度和确认 HTML；解耦评估：经专属网关使用共享文本编码器。 */
import {escapeHtml} from "./imports";
/** 用途：上传文案；使用范围：验证与确认；解耦评估：经专属网关直达 i18n 环境。 */
import {siyuanI18n} from "./imports";
/** 用途：XHR 请求完整上下文；使用范围：状态与进度回调；解耦评估：同域纯类型直达声明。 */
import type {UploadRequestContext} from "./transport.types";
/** 用途：创建 XHR；使用范围：遗留与 Protyle 上传；解耦评估：同域构造边界不保存请求状态。 */
import {createUploadXHR} from "./xhr.factory";
/** 用途：校验目录文件路径；使用范围：输入规范化；解耦评估：同域结构守卫显式拒绝缺失路径。 */
import {isUploadFileWithPath} from "./transport.guard";

/** 判断单个 accept 条目是否接受目标文件。 */
const matchesAcceptedType = (file: File, fileExtension: string, acceptedType: string) => {
    const type = acceptedType.trim();
    if (type.startsWith(".")) {
        return fileExtension.toLowerCase() === type.toLowerCase();
    }
    return file.type.split("/")[0] === type.split("/")[0];
};

/** 验证单个文件并生成实际上传文件名。 */
const checkFile = (file: File, protyle: IProtyle) => {
    if (!file.name) {
        return {validate: false, errorTip: `<li>${siyuanI18n.nameEmpty}</li>`};
    }
    if (file.size > protyle.options.upload.max) {
        return {
            validate: false,
            errorTip: `<li>${escapeHtml(file.name)} ${siyuanI18n.over} ${protyle.options.upload.max / 1024 / 1024}M</li>`,
        };
    }
    const lastIndex = file.name.lastIndexOf(".");
    const fileExt = lastIndex === -1 ? "" : file.name.substring(lastIndex);
    const filename = lastIndex === -1
        ? file.name
        : protyle.options.upload.filename(file.name.substring(0, lastIndex)) + fileExt;
    const acceptsFile = !protyle.options.upload.accept ||
        protyle.options.upload.accept.split(",").some(item => matchesAcceptedType(file, fileExt, item));
    if (!acceptsFile) {
        return {validate: false, errorTip: `<li>${escapeHtml(file.name)} ${siyuanI18n.fileTypeError}</li>`};
    }
    return {validate: true, filename, errorTip: ""};
};

/** 验证整批文件并建立进度消息。 */
const validateFiles = (protyle: IProtyle, files: File[]) => {
    const uploadFiles: File[] = [];
    let errorTip = "";
    let uploadingText = "";
    for (const file of files) {
        const result = checkFile(file, protyle);
        if (!result.validate) {
            errorTip += result.errorTip;
            continue;
        }
        uploadFiles.push(file);
        uploadingText += `<li>${escapeHtml(result.filename)} ${siyuanI18n.uploading}</li>`;
    }
    const hasMessage = errorTip !== "" || uploadingText !== "";
    const msgId = hasMessage ? showMessage(`<ul>${errorTip}${uploadingText}</ul>`, -1) : undefined;
    return {files: uploadFiles, msgId};
};

/** 处理没有 Protyle 上下文的历史上传入口。 */
const handleLegacyUpload = (
    files: FileList | DataTransferItemList | File[],
    element?: HTMLInputElement,
    successCB?: (responseText: string) => void
) => {
    const formData = new FormData();
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        // DataTransferItem 无法直接追加到 FormData，遗留无编辑器入口只接受实际 File。
        if (file instanceof File) {
            formData.append("file[]", file);
        }
    }
    const xhr = createUploadXHR();
    xhr.open("POST", Constants.UPLOAD_ADDRESS);
    xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
            return;
        }
        // 200 沿用历史入口的显式成功回调。
        if (xhr.status === 200) {
            successCB?.(xhr.responseText);
        }
        // 状态 0 表示网络层未获得 HTTP 响应。
        if (xhr.status === 0) {
            showMessage(siyuanI18n.fileTypeError);
        }
        // 其它 HTTP 错误直接展示响应文本。
        if (xhr.status !== 0 && xhr.status !== 200) {
            showMessage(xhr.responseText);
        }
        if (element) {
            element.value = "";
        }
    };
    xhr.send(formData);
};

/** 读取目录伪文件路径，协议不完整时显式失败。 */
const requireDirectoryPath = (file: File) => {
    if (!isUploadFileWithPath(file)) {
        throw new Error("upload directory file is missing its local path");
    }
    return file.path;
};

/** 把浏览器输入规范化为普通文件，并将目录交给完整 Protyle 领域根。 */
const processFiles = (files: FileList | DataTransferItemList | File[], protyle: IProtyle) => {
    const fileList: File[] = [];
    for (let index = 0; index < files.length; index++) {
        const inputItem = files[index];
        const fileItem = inputItem instanceof DataTransferItem ? inputItem.getAsFile() : inputItem;
        if (!fileItem) {
            continue;
        }
        const isDirectory = fileItem.size === 0 && fileItem.type === "" && !fileItem.name.includes(".");
        if (isDirectory) {
            protyle.getInstance().uploadLocalFiles([{path: requireDirectoryPath(fileItem), size: null}], false);
            continue;
        }
        fileList.push(fileItem);
    }
    return protyle.options.upload?.file ? protyle.options.upload.file(fileList) : fileList;
};

/** 按既有优先级分派上传成功结果。 */
const handleSuccessfulUpload = (xhr: XMLHttpRequest, context: UploadRequestContext) => {
    hideMessage(context.msgId);
    const uploadOptions = context.protyle.options.upload;
    // options.success 完全接管成功响应，优先级高于调用点 callback。
    if (uploadOptions?.success) {
        uploadOptions.success(context.editorElement, xhr.responseText);
        return;
    }
    if (context.successCB) {
        context.successCB(xhr.responseText);
        return;
    }
    const responseText = uploadOptions?.format
        ? uploadOptions.format(context.fileList, xhr.responseText)
        : xhr.responseText;
    void context.protyle.getInstance().applyUploadedFiles(responseText);
};

/** 处理非成功 HTTP 状态并保持自定义错误回调优先级。 */
const handleFailedUpload = (xhr: XMLHttpRequest, protyle: IProtyle) => {
    // 状态 0 使用内核网络错误文案，不交给 HTTP 错误处理。
    if (xhr.status === 0) {
        const kernelLanguages = window.siyuan.languages["_kernel"];
        showMessage(kernelLanguages[28]);
        return;
    }
    // 配置的 error hook 优先于默认消息。
    if (protyle.options.upload?.error) {
        protyle.options.upload.error(xhr.responseText);
        return;
    }
    showMessage(xhr.responseText);
};

/** 完成 XHR 生命周期、结果分派和 UI 清理。 */
const handleXHRStateChange = (xhr: XMLHttpRequest, context: UploadRequestContext) => {
    if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
    }
    // 已初始化上传状态时同步解除进行中标记。
    if (context.protyle.upload) {
        context.protyle.upload.isUploading = false;
    }
    // 请求期间编辑器被移除时，沿用原生命周期清理并停止结果投影。
    if (context.protyle.element && !document.body.contains(context.protyle.element)) {
        destroy(context.protyle);
        return;
    }
    // 成功响应按固定优先级分派。
    if (xhr.status === 200) {
        handleSuccessfulUpload(xhr, context);
    }
    // 非 200 响应进入可观察错误路径。
    if (xhr.status !== 200) {
        handleFailedUpload(xhr, context.protyle);
    }
    if (context.element) {
        context.element.value = "";
    }
    // 存在进度条时在任何完成状态下隐藏。
    if (context.protyle.upload?.element) {
        context.protyle.upload.element.style.display = "none";
    }
};

/** 同步上传进度条宽度。 */
const handleUploadProgress = (event: ProgressEvent, protyle: IProtyle) => {
    if (!event.lengthComputable || !protyle.upload?.element) {
        return;
    }
    protyle.upload.element.style.display = "block";
    protyle.upload.element.style.width = `${event.loaded / event.total * 100}%`;
};

/** 配置并发送一次 XHR 上传。 */
const performXHRUpload = (formData: FormData, context: UploadRequestContext) => {
    const xhr = createUploadXHR();
    const uploadOptions = context.protyle.options.upload;
    // URL 是发送 XHR 的必要配置，缺失时显式提示并终止。
    if (!uploadOptions?.url) {
        showMessage("options.upload.url is missing");
        return;
    }
    xhr.open("POST", uploadOptions.url);
    if (uploadOptions.token) {
        xhr.setRequestHeader("X-Upload-Token", uploadOptions.token);
    }
    xhr.withCredentials = !!uploadOptions.withCredentials;
    // 已初始化上传状态时标记请求进行中。
    if (context.protyle.upload) {
        context.protyle.upload.isUploading = true;
    }
    xhr.onreadystatechange = () => handleXHRStateChange(xhr, context);
    xhr.upload.onprogress = event => handleUploadProgress(event, context.protyle);
    xhr.send(formData);
};

/** 构造上传表单和大文件确认文案。 */
const buildUploadForm = (protyle: IProtyle, files: File[]) => {
    const formData = new FormData();
    const extraData = protyle.options.upload.extraData;
    if (extraData) {
        for (const key of Object.keys(extraData)) {
            formData.append(key, extraData[key]);
        }
    }
    let confirmation = "";
    for (const file of files) {
        formData.append(protyle.options.upload.fieldName, file);
        // 超过提示阈值的文件进入发送前确认文案。
        if (Constants.SIZE_UPLOAD_TIP_SIZE <= file.size) {
            confirmation += siyuanI18n.uploadFileTooLarge
                .replace("${x}", escapeHtml(file.name))
                .replace("${y}", filesize(file.size, {standard: "iec"})) + "<br>";
        }
    }
    if (protyle.lite) {
        formData.append("assetsDirPath", "/assets/");
    }
    if (!protyle.lite) {
        formData.append("id", protyle.block?.rootID);
    }
    return {formData, confirmation};
};

/** 清空一次性文件输入。 */
const clearUploadInput = (element?: HTMLInputElement) => {
    if (element) {
        element.value = "";
    }
};

/** 执行完全接管上传的 handler，并报告请求是否已被接管。 */
const handleCustomUpload = (uploadOptions: IUpload, fileList: File[]) => {
    if (!uploadOptions.handler) {
        return false;
    }
    const validation = uploadOptions.handler(fileList);
    if (typeof validation === "string") {
        showMessage(validation);
    }
    return true;
};

/** 执行继续使用内置传输时的可选验证 hook。 */
const passesCustomValidation = (uploadOptions: IUpload, fileList: File[]) => {
    const validation = uploadOptions.validate?.(fileList);
    if (typeof validation !== "string") {
        return true;
    }
    showMessage(validation);
    return false;
};

/** 执行上传配置、用户 hook 和文件验证门禁，返回可发送的文件集合。 */
const prepareUploadFiles = (protyle: IProtyle, fileList: File[], element?: HTMLInputElement) => {
    const uploadOptions = protyle.options.upload;
    if (handleCustomUpload(uploadOptions, fileList)) {
        return undefined;
    }
    // 内置传输同时要求 URL 和上传状态对象已经初始化。
    if (!uploadOptions.url || !protyle.upload) {
        clearUploadInput(element);
        showMessage("please config: options.upload.url");
        return undefined;
    }
    if (!passesCustomValidation(uploadOptions, fileList)) {
        return undefined;
    }
    const validated = validateFiles(protyle, fileList);
    if (validated.files.length > 0) {
        return validated;
    }
    clearUploadInput(element);
    return undefined;
};

/**
 * 上传文件并按 options success、显式 callback、Protyle 默认结果的既有优先级分派响应。
 * @参数豁免: 遗留代码 - 保持公开 `uploadFiles(protyle, files, element, successCB)` 调用协议与所有插件调用点兼容。
 */
export const uploadFiles =
/**
 * @参数豁免: 遗留代码 - 保持公开四参数上传协议与插件及现有调用点兼容。
 * @同步豁免: UI构建 - 必须同步执行文件 hook、建立确认 Dialog 并绑定同一批 FormData；实际网络完成仍由 XHR 异步回调。
 */
(
    protyle: IProtyle,
    files: FileList | DataTransferItemList | File[],
    element?: HTMLInputElement,
    successCB?: (responseText: string) => void
) => {
    if (!protyle) {
        handleLegacyUpload(files, element, successCB);
        return;
    }
    const fileList = processFiles(files, protyle);
    const validated = prepareUploadFiles(protyle, fileList, element);
    if (!validated) {
        return;
    }
    const {formData, confirmation} = buildUploadForm(protyle, validated.files);
    const context: UploadRequestContext = {
        protyle,
        msgId: validated.msgId,
        editorElement: protyle.wysiwyg.element,
        fileList,
        element,
        successCB,
    };
    confirmDialog(confirmation ? siyuanI18n.upload : "", confirmation, () => performXHRUpload(formData, context), () => {
        hideMessage(validated.msgId);
    });
};
