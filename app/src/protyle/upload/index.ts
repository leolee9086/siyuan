// S-forge: 代码重构 - 保持本地的模块化导入风格，同时添加远程的新导入
import { insertHTML } from "../util/insertHTML";
import { hideMessage, showMessage } from "../runtime/dialog.port";
import { Constants } from "../../constants";
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
import {transaction} from "../wysiwyg/transaction/submit";
import * as dayjs from "dayjs";

export class Upload {
    public element: HTMLElement;
    public isUploading: boolean;

    constructor() {
        this.isUploading = false;
        this.element = document.createElement("div");
        this.element.className = "protyle-upload";
    }
}

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

export const applyUploadedFiles = async (responseText: string, protyle: IProtyle) => {
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
            void protyle.getInstance().applyUploadedFiles(JSON.stringify(response));
        });
    };

    confirmDialog(msg ? siyuanI18n.upload : "", msg, performUpload);
};
