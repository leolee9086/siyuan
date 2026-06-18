/** 用途：获取 Canvas 截图。使用范围：PDF 页面导出。解耦评估：同目录模块直接导入。 */
import { getCaptureCanvas } from "./anno.getCaptureCanvas";
/** 用途：PDF 实例类型。使用范围：导出函数参数类型。解耦评估：同目录类型文件。 */
import { IPdfInstance } from "./anno.types";

/**
 * 触发浏览器下载文件
 *
 * @作用 创建临时下载链接并触发点击，实现文件下载
 * @意图 将下载逻辑独立出来，便于复用
 * @调用时机 在需要下载文件时调用
 *
 * @param dataUrl - 文件的数据URL
 * @param fileName - 下载的文件名
 */
function 触发下载(dataUrl: string, fileName: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 生成下载文件名
 *
 * @作用 根据当前时间生成唯一的文件名
 * @意图 确保每次下载的文件名不重复
 * @调用时机 在下载图片时调用
 *
 * @param prefix - 文件名前缀
 * @param extension - 文件扩展名
 * @returns 格式如 "prefix_20260102_011516.extension" 的文件名
 */
function 生成下载文件名(prefix: string, extension: string) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[-:T]/g, "")
        .replace(/\..+/, "")
        .slice(0, 14);
    const formatted = `${timestamp.slice(0, 8)}_${timestamp.slice(8)}`;
    return `${prefix}_${formatted}.${extension}`;
}

/**
 * 导出PDF当前页为PNG图片
 *
 * @作用 获取PDF当前页面的Canvas并下载为PNG图片
 * @意图 让用户能够方便地导出PDF页面，不再局限于矩形截图
 * @调用时机 当用户点击右键菜单的“导出本页为图片”时调用
 *
 * @param pdf - PDF实例对象
 */
export async function exportPageAsPng(pdf: IPdfInstance) {
    const pageNumber = pdf.pdfViewer.currentPageNumber;
    if (!pageNumber) {
        return;
    }

    const canvas = await getCaptureCanvas(pdf, pageNumber);
    const dataUrl = canvas.toDataURL("image/png");

    const fileName = 生成下载文件名(`page_${pageNumber}`, "png");
    触发下载(dataUrl, fileName);
}
