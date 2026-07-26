// S-forge: 代码重构 - 保持本地的模块化导入风格，同时添加远程的新导入
import { insertHTML } from "../util/insertHTML";
import { hideMessage, showMessage } from "../runtime/dialog.port";
import { Constants } from "../../constants";
import { destroy } from "../util/destroy";
import { fetchPost } from "../../util/network/fetch";
import { getEditorRange } from "../util/selection";
import { pathPosix } from "../../util/file/pathName";
import { genAssetHTML } from "../../asset/renderAssets";
import { hasClosestBlock, hasClosestByClassName } from "../util/hasClosest";
import { getContenteditableElement } from "../wysiwyg/getBlock";
import {getTypeByCellElement} from "../render/av/cell/position";
import {updateCellsValue} from "../render/av/cell.update";
import { scrollCenter } from "../../util/DOM/highlightById";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { confirmDialog } from "../runtime/dialog.port";
import { filesize } from "filesize";
import { transaction } from "../wysiwyg/transaction";
import * as dayjs from "dayjs";

/**
 * 带有路径信息的文件接口
 * @property path - 文件的完整路径
 */
interface FileWithPath extends File {
    path: string;
}

export class Upload {
    public element: HTMLElement;
    public isUploading: boolean;

    constructor() {
        this.isUploading = false;
        this.element = document.createElement("div");
        this.element.className = "protyle-upload";
    }
}

const checkFile = (file: File, protyle: IProtyle) => {
    let errorTip = "";
    if (!file.name) {
        errorTip += `<li>${siyuanI18n.nameEmpty}</li>`;
        return { validate: false, errorTip };
    }
    if (file.size > protyle.options.upload.max) {
        errorTip += `<li>${file.name} ${siyuanI18n.over} ${protyle.options.upload.max / 1024 / 1024}M</li>`;
        return { validate: false, errorTip };
    }
    const lastIndex = file.name.lastIndexOf(".");
    const fileExt = lastIndex === -1 ? "" : file.name.substring(lastIndex);
    const filename = lastIndex === -1 ? file.name : (protyle.options.upload.filename(file.name.substring(0, lastIndex)) + fileExt);

    if (protyle.options.upload.accept) {
        const isAccept = protyle.options.upload.accept.split(",").some((item) => {
            const type = item.trim();
            if (type.indexOf(".") === 0) {
                return fileExt.toLowerCase() === type.toLowerCase();
            }
            return file.type.split("/")[0] === type.split("/")[0];
        });
        if (!isAccept) {
            errorTip += `<li>${file.name} ${siyuanI18n.fileTypeError}</li>`;
            return { validate: false, errorTip };
        }
    }
    return { validate: true, filename };
};

const validateFile = (protyle: IProtyle, files: File[]) => {
    const uploadFileList: File[] = [];
    let errorTip = "";
    let uploadingStr = "";

    for (const file of files) {
        const result = checkFile(file, protyle);
        if (result.validate) {
            uploadFileList.push(file);
            uploadingStr += `<li>${result.filename} ${siyuanI18n.uploading}</li>`;
        } else {
            errorTip += result.errorTip;
        }
    }
    let msgId;
    if (errorTip !== "" || uploadingStr !== "") {
        msgId = showMessage(`<ul>${errorTip}${uploadingStr}</ul>`, -1);
    }
    return { files: uploadFileList, msgId };
};

const handleUploadResult = (protyle: IProtyle, response: any) => {
    let errorTip = "";
    if (response.code === 1) {
        errorTip = `${response.msg}`;
    }
    if (response.data.errFiles?.length > 0) {
        errorTip = `<ul><li>${errorTip}</li>`;
        for (const data of response.data.errFiles) {
            const lastIndex = data.lastIndexOf(".");
            const filename = lastIndex === -1 ? data : (protyle.options.upload.filename(data.substring(0, lastIndex)) + data.substring(lastIndex));
            errorTip += `<li>${filename} ${siyuanI18n.uploadError}</li>`;
        }
        errorTip += "</ul>";
    }
    if (errorTip) {
        showMessage(errorTip);
    }
    return !!errorTip;
};

const genUploadedLabel = async (responseText: string, protyle: IProtyle) => {
    const response = JSON.parse(responseText);
    if (handleUploadResult(protyle, response)) {
        return;
    }

    let insertBlock = true;
    const range = getEditorRange(protyle.wysiwyg.element);
    if (range.toString() === "" && range.startContainer.nodeType === 3 && protyle.toolbar.getCurrentType(range).length > 0) {
        // 防止链接插入其他元素中 https://ld246.com/article/1676003478664
        range.setEndAfter(range.startContainer.parentElement);
        range.collapse(false);
    }

    const keys = Object.keys(response.data.succMap);
    // https://github.com/siyuan-note/siyuan/issues/7624
    const nodeElement = hasClosestBlock(range.startContainer);
    if (nodeElement) {
        if (nodeElement.classList.contains("table")) {
            insertBlock = false;
        } else {
            const editableElement = getContenteditableElement(nodeElement);
            if (editableElement && nodeElement.classList.contains("p") &&
                (editableElement.textContent !== "" || keys.length < 2)) {
                insertBlock = false;
            }
        }
    }

    let successFileText = "";
    // 插入多个资源文件时按文件名自然升序排列 Use natural ascending order when inserting multiple assets https://github.com/siyuan-note/siyuan/issues/14643
    keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const avAssets: IAVCellAssetValue[] = [];
    let hasImage = false;

    for (const [index, key] of keys.entries()) {
        const path = response.data.succMap[key];
        const type = pathPosix().extname(key).toLowerCase();
        const filename = protyle.options.upload.filename(key);
        const name = filename.substring(0, filename.length - type.length);
        hasImage = Constants.SIYUAN_ASSETS_IMAGE.includes(type);

        avAssets.push({
            type: Constants.SIYUAN_ASSETS_IMAGE.includes(type) ? "image" : "file",
            content: path,
            name
        });

        successFileText += genAssetHTML(type, path, name, filename);
        if (!Constants.SIYUAN_ASSETS_AUDIO.includes(type) && !Constants.SIYUAN_ASSETS_VIDEO.includes(type) &&
            keys.length - 1 !== index) {
            if (nodeElement && nodeElement.classList.contains("table")) {
                successFileText += "<br>";
            } else if (insertBlock) {
                successFileText += "\n\n";
            } else {
                successFileText += "\n";
            }
        }
    }

    if (document.querySelector(".av__panel")) {
        const avValueCall = document.querySelector('.custom-attr__avvalue[data-type="mAsset"][data-active="true"]') as HTMLElement;
        const cellElements: HTMLElement[] = avValueCall ? [avValueCall] : [];
        if (cellElements.length === 0) {
            const activeCells = protyle.wysiwyg.element.querySelectorAll(".av__cell--active");
            for (const item of activeCells) {
                if (getTypeByCellElement(item as HTMLElement) === "mAsset") {
                    cellElements.push(item as HTMLElement);
                }
            }
            if (cellElements.length === 0) {
                const panelItems = document.querySelector(".av__panel .b3-menu__items")?.getAttribute("data-ids")?.split(",");
                if (panelItems) {
                    for (const id of panelItems) {
                        const item = protyle.wysiwyg.element.querySelector(`.av__gallery-fields [data-dtype="mAsset"][data-id="${id}"]`) as HTMLElement;
                        if (item) {
cellElements.push(item);
}
                    }
                }
            }
        }
        if (cellElements.length > 0) {
            const blockElement = hasClosestBlock(cellElements[0]);
            if (blockElement) {
                updateCellsValue(protyle, blockElement, avAssets, cellElements);
                document.querySelector(".av__panel")?.remove();
                return;
            }
        } else {
            return;
        }
    } else if (nodeElement && nodeElement.classList.contains("av")) {
        const cellElements: HTMLElement[] = [];
        const rows = nodeElement.querySelectorAll(".av__row--select:not(.av__row--header)");
        for (const item of rows) {
            const cells = item.querySelectorAll(".av__cell");
            for (const cellItem of cells) {
                if (getTypeByCellElement(cellItem as HTMLElement) === "mAsset") {
                    cellElements.push(cellItem as HTMLElement);
                }
            }
        }
        if (cellElements.length === 0) {
            const activeCells = protyle.wysiwyg.element.querySelectorAll(".av__cell--active");
            for (const item of activeCells) {
                if (getTypeByCellElement(item as HTMLElement) === "mAsset") {
                    cellElements.push(item as HTMLElement);
                }
            }
        }
        if (cellElements.length === 1) {
            updateCellsValue(protyle, nodeElement, avAssets, cellElements);
        } else if (cellElements.length > 1) {
            const doOperations: IOperation[] = [];
            const undoOperations: IOperation[] = [];
            let currentRowElement;
            const colId = cellElements[0].getAttribute("data-col-id");
            for (let i = 0; i < avAssets.length; i++) {
                let cellElement = cellElements[i];
                if (!cellElement) {
                    if (!currentRowElement) {
                        currentRowElement = hasClosestByClassName(cellElements[i - 1], "av__row") as HTMLElement;
                    }
                    if (currentRowElement) {
                        currentRowElement = currentRowElement.nextElementSibling;
                        if (currentRowElement && currentRowElement.classList.contains("av__row")) {
                            cellElement = currentRowElement.querySelector(`.av__cell[data-col-id="${colId}"]`);
                        }
                    }
                }
                if (!cellElement) {
                    break;
                }
                const operations = await updateCellsValue(protyle, nodeElement,
                    [avAssets[i]], [cellElement], null, null, true);
                doOperations.push(...operations.doOperations);
                undoOperations.push(...operations.undoOperations);
            }
            if (doOperations.length > 0) {
                const id = nodeElement.dataset.nodeId;
                doOperations.push({
                    action: "doUpdateUpdated",
                    id,
                    data: dayjs().format("YYYYMMDDHHmmss"),
                });
                undoOperations.push({
                    action: "doUpdateUpdated",
                    id,
                    data: nodeElement.getAttribute("updated"),
                });
                transaction(protyle, doOperations, undoOperations);
            }
        }
        return;
    }

    // 避免插入代码块中，其次因为都要独立成块 https://github.com/siyuan-note/siyuan/issues/7607
    insertHTML(successFileText, protyle, insertBlock);
    // 粘贴图片后定位不准确 https://github.com/siyuan-note/siyuan/issues/13336
    setTimeout(() => {
        scrollCenter(protyle, undefined, "nearest", "smooth");
    }, hasImage ? 0 : Constants.TIMEOUT_LOAD);
};

/**
 * 上传本地文件
 * @param files 文件列表
 * @param protyle 编辑器实例
 * @param isUpload 是否上传
 */
export const uploadLocalFiles = (files: string[] | ILocalFiles[], protyle: IProtyle, isUpload: boolean) => {
    let msg = "";
    const assetPaths: string[] = [];
    for (const item of files) {
        if (typeof item === "string") {
            assetPaths.push(item);
        } else {
            if (item.size && Constants.SIZE_UPLOAD_TIP_SIZE <= item.size) {
                msg += siyuanI18n.uploadFileTooLarge.replace("${x}", item.path).replace("${y}", filesize(item.size, { standard: "iec" })) + "<br>";
            }
            assetPaths.push(item.path);
        }
    }

    const performUpload = () => {
        const msgId = showMessage(siyuanI18n.uploading, 0);
        fetchPost("/api/asset/insertLocalAssets", {
            assetPaths,
            isUpload,
            id: protyle.block.rootID
        }, (response) => {
            hideMessage(msgId);
            let tip = "";
            for (const name of Object.keys(response.data.succMap)) {
                if (response.data.succMap[name].startsWith("file:")) {
                    tip += name + ", ";
                }
            }
            if (tip) {
                showMessage(siyuanI18n.dndFolderTip.replace("${x}", `<b>${tip.substring(0, tip.length - 2)}</b>`));
            }
            genUploadedLabel(JSON.stringify(response), protyle);
        });
    };

    confirmDialog(msg ? siyuanI18n.upload : "", msg, performUpload);
};

/**
 * 处理遗留的上传逻辑（非 Protyle 环境）
 * @param files - 文件列表
 * @param element - 上传 input 元素
 * @param successCB - 成功回调
 */
const handleLegacyUpload = (files: FileList | DataTransferItemList | File[], element?: HTMLInputElement, successCB?: (res: string) => void) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append("file[]", files[i] as File);
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", Constants.UPLOAD_ADDRESS);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                successCB?.(xhr.responseText);
            } else if (xhr.status === 0) {
                showMessage(siyuanI18n.fileTypeError);
            } else {
                showMessage(xhr.responseText);
            }
            if (element) {
                element.value = "";
            }
        }
    };
    xhr.send(formData);
};

/**
 * 处理并过滤待上传的文件
 * @param files - 原始文件列表
 * @param protyle - 编辑器实例
 * @returns 处理后的文件数组
 */
const processFiles = (files: FileList | DataTransferItemList | File[], protyle: IProtyle) => {
    let fileList: File[] = [];
    for (let i = 0; i < files.length; i++) {
        let fileItem = files[i];
        if (fileItem instanceof DataTransferItem) {
            fileItem = fileItem.getAsFile();
        }
        if (fileItem && 0 === fileItem.size && "" === fileItem.type && -1 === fileItem.name.indexOf(".")) {
            // 文件夹
            uploadLocalFiles([{ path: (fileItem as FileWithPath).path, size: null }], protyle, false);
        } else if (fileItem) {
            fileList.push(fileItem as File);
        }
    }
    if (protyle.options.upload?.file) {
        fileList = protyle.options.upload.file(fileList);
    }
    return fileList;
};

/**
 * 处理 XHR 状态变更
 * @param xhr - XMLHttpRequest 对象
 * @param protyle - 编辑器实例
 * @param msgId - 消息 ID
 * @param editorElement - 编辑器 DOM 元素
 * @param fileList - 文件列表
 * @param successCB - 成功回调
 * @param element - 上传 input 元素
 */
const handleXHRStateChange = (xhr: XMLHttpRequest, protyle: IProtyle, msgId: string, editorElement: HTMLElement, fileList: File[], successCB?: (res: string) => void, element?: HTMLInputElement) => {
    if (xhr.readyState !== XMLHttpRequest.DONE) {
return;
}

    if (protyle.upload) {
        protyle.upload.isUploading = false;
    }
    if (protyle.element && !document.body.contains(protyle.element)) {
        destroy(protyle);
        return;
    }

    if (xhr.status === 200) {
        hideMessage(msgId);
        if (protyle.options.upload?.success) {
            protyle.options.upload.success(editorElement, xhr.responseText);
        } else if (successCB) {
            successCB(xhr.responseText);
        } else {
            let responseText = xhr.responseText;
            if (protyle.options.upload?.format) {
                responseText = protyle.options.upload.format(fileList, xhr.responseText);
            }
            genUploadedLabel(responseText, protyle);
        }
    } else if (xhr.status === 0) {
        showMessage(window.siyuan.languages["_kernel"][28]);
    } else {
        if (protyle.options.upload?.error) {
            protyle.options.upload.error(xhr.responseText);
        } else {
            showMessage(xhr.responseText);
        }
    }

    if (element) {
        element.value = "";
    }
    if (protyle.upload?.element) {
        protyle.upload.element.style.display = "none";
    }
};

/**
 * 执行 XHR 上传请求
 * @param protyle - 编辑器实例
 * @param formData - 表单数据
 * @param msgId - 消息 ID
 * @param editorElement - 编辑器 DOM 元素
 * @param fileList - 文件列表
 * @param validateResultFiles - 验证通过的文件列表
 * @param element - 上传 input 元素
 * @param successCB - 成功回调
 */
const performXHRUpload = (protyle: IProtyle, formData: FormData, msgId: string, editorElement: HTMLElement, fileList: File[], validateResultFiles: File[], element?: HTMLInputElement, successCB?: (res: string) => void) => {
    const xhr = new XMLHttpRequest();
    if (protyle.options.upload?.url) {
        xhr.open("POST", protyle.options.upload.url);
    } else {
        showMessage("options.upload.url is missing");
        return;
    }

    if (protyle.options.upload.token) {
        xhr.setRequestHeader("X-Upload-Token", protyle.options.upload.token);
    }
    if (protyle.options.upload.withCredentials) {
        xhr.withCredentials = true;
    }

    if (protyle.upload) {
        protyle.upload.isUploading = true;
    }

    xhr.onreadystatechange = () => handleXHRStateChange(xhr, protyle, msgId, editorElement, fileList, successCB, element);

    xhr.upload.onprogress = (event: ProgressEvent) => {
        if (!event.lengthComputable) {
            return;
        }
        const progress = event.loaded / event.total * 100;
        if (protyle.upload?.element) {
            protyle.upload.element.style.display = "block";
            protyle.upload.element.style.width = progress + "%";
        }
    };
    xhr.send(formData);
};

/**
 * 上传文件
 * @param protyle 编辑器实例
 * @param files 文件列表
 * @param element 上传 input 元素
 * @param successCB 成功回调
 */
export const uploadFiles = (protyle: IProtyle, files: FileList | DataTransferItemList | File[], element?: HTMLInputElement, successCB?: (res: string) => void) => {
    if (!protyle) {
        handleLegacyUpload(files, element, successCB);
        return;
    }

    const fileList = processFiles(files, protyle);

    if (protyle.options.upload.handler) {
        const isValidate = protyle.options.upload.handler(fileList);
        if (typeof isValidate === "string") {
            showMessage(isValidate);
            return;
        }
        return;
    }

    if (!protyle.options.upload.url || !protyle.upload) {
        if (element) {
            element.value = "";
        }
        showMessage("please config: options.upload.url");
        return;
    }

    if (protyle.options.upload.validate) {
        const isValidate = protyle.options.upload.validate(fileList);
        if (typeof isValidate === "string") {
            showMessage(isValidate);
            return;
        }
    }

    const validateResult = validateFile(protyle, fileList);
    if (validateResult.files.length === 0) {
        if (element) {
            element.value = "";
        }
        return;
    }

    const formData = new FormData();
    const extraData = protyle.options.upload.extraData;
    if (extraData) {
        for (const key of Object.keys(extraData)) {
            formData.append(key, extraData[key]);
        }
    }

    let msg = "";
    for (const file of validateResult.files) {
        formData.append(protyle.options.upload.fieldName, file);
        if (Constants.SIZE_UPLOAD_TIP_SIZE <= file.size) {
            msg += siyuanI18n.uploadFileTooLarge.replace("${x}", file.name).replace("${y}", filesize(file.size, { standard: "iec" })) + "<br>";
        }
    }
    if (protyle.lite) {
        formData.append("assetsDirPath", "/assets/");
    } else {
        formData.append("id", protyle.block?.rootID);
    }

    const startUpload = () => {
        performXHRUpload(protyle, formData, validateResult.msgId, protyle.wysiwyg.element, fileList, validateResult.files, element, successCB);
    };

    confirmDialog(msg ? siyuanI18n.upload : "", msg, startUpload, () => {
        hideMessage(validateResult.msgId);
    });
};
