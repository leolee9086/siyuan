/**
 * 外部文件/HTML 拖拽操作辅助模块
 *
 * 作用：处理从系统文件管理器或浏览器拖入编辑器的文件和 HTML 内容
 * 意图：从 onDrop 主函数中提取外部拖拽逻辑，降低主函数复杂度
 * 调用时机：当 dataTransfer 类型为 Files 或 text/html 且无 dragElement 时
 */
import { hasClosestByClassName, hasClosestBlock } from "../hasClosest";
import { focusByRange, getRangeByPoint } from "../selection";
import { isBrowser } from "../../../util/platform/functions";
import {uploadLocalFiles} from "../../upload";
import {uploadFiles} from "../../upload/transport";
import { paste } from "../paste";
import { clearSelect } from "../clearSelect";
import {getTypeByCellElement} from "../../render/av/cell/position";
import { dragUpload } from "../../render/av/asset";
import { getPathForFile } from "../../../platform/electron/webUtils";
import { focusBlock } from "../selection.focus";

/**
 * 从 dataTransfer 中收集本地文件路径列表
 *
 * 作用：遍历 dataTransfer.files 提取每个文件的本地路径
 * 意图：统一文件路径收集逻辑，避免重复代码
 * 调用时机：外部文件拖入编辑器或 AV 单元格时
 *
 * @param dataTransfer 拖拽事件的 dataTransfer 对象
 * @returns 本地文件路径数组
 */
const collectFilePaths = (dataTransfer: DataTransfer): string[] => {
    const files: string[] = [];
    for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        // files[i] 通过索引访问可能为 undefined
        if (file) {
            files.push(getPathForFile(file));
        }
    }
    return files;
};

/**
 * 外部文件拖入编辑器非 AV 区域
 *
 * 作用：将外部文件上传或粘贴 HTML 内容到编辑器光标位置
 * 意图：非 AV 区域的外部拖拽分为文件上传和 HTML 粘贴两种情况
 * 调用时机：外部拖拽目标不在 AV 元素内时
 *
 * @param protyle 编辑器实例
 * @param event 拖拽事件
 */
export const handleExternalEditorDrop = async (
    protyle: IProtyle,
    event: DragEvent & { target: HTMLElement },
): Promise<void> => {
    // dataTransfer 为 null 时无法处理
    if (!event.dataTransfer) {
        return;
    }
    const range = getRangeByPoint(event.clientX, event.clientY);
    // range 可能为 null（点击位置无文本节点）
    if (!range) {
        return;
    }
    focusByRange(range);
    const hasFiles = event.dataTransfer.types.includes("Files");
    // 本地文件拖入：上传文件（altKey 控制是否作为资源插入）
    if (hasFiles && !isBrowser()) {
        const files: string[] = [];
        for (let i = 0; i < event.dataTransfer.files.length; i++) {
            const file = event.dataTransfer.files[i];
            if (file) {
                const filePath = getPathForFile(file);
                if (filePath) {
                    files.push(filePath);
                } else {
                    paste(protyle, event);
                    break;
                }
            }
        }
        if (files.length > 0) {
            uploadLocalFiles(files, protyle, !event.altKey);
        }
    }
    // HTML 内容拖入：走粘贴逻辑
    if (!hasFiles || isBrowser()) {
        paste(protyle, event);
    }
    // wysiwyg 可能未初始化
    if (protyle.wysiwyg?.element) {
        clearSelect(["av", "img"], protyle.wysiwyg.element);
    }
};

/**
 * 外部文件拖入 AV 单元格（资源类型列）
 *
 * 作用：将外部文件作为资源上传到 AV 的 mAsset 类型单元格
 * 意图：仅处理 mAsset 类型单元格的文件拖入，其他类型忽略
 * 调用时机：外部拖拽目标在 AV 元素内时
 *
 * @param protyle 编辑器实例
 * @param event 拖拽事件
 * @param avElement AV 容器元素
 */
export const handleExternalAvCellDrop = async (
    protyle: IProtyle,
    event: DragEvent & { target: HTMLElement },
    avElement: HTMLElement,
): Promise<void> => {
    const cellElement = hasClosestByClassName(event.target, "av__cell");
    // 目标不是单元格，忽略
    if (!cellElement) {
        return;
    }
    // dataTransfer 为 null 时无法处理
    if (!event.dataTransfer) {
        return;
    }
    const hasFiles = event.dataTransfer.types.includes("Files");
    // 仅处理 mAsset 类型单元格的文件拖入
    if (getTypeByCellElement(cellElement) !== "mAsset") {
        return;
    }
    // 非文件类型，忽略
    if (!hasFiles) {
        return;
    }
    // Electron 环境：使用 dragUpload
    if (!isBrowser()) {
        const files = collectFilePaths(event.dataTransfer);
        dragUpload(files, protyle, cellElement);
    }
    // 浏览器环境：简化处理，直接上传文件（上游改进：移除复杂的 updateAssetCell 逻辑）
    if (isBrowser()) {
        const blockElement = hasClosestBlock(cellElement);
        if (blockElement) {
            focusBlock(blockElement as HTMLElement);
            uploadFiles(protyle, event.dataTransfer.files, undefined);
        }
    }
};
