/** 用途：通过类名查找祖先元素。使用范围：获取 PDF 页面元素。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：HTMLElement 类型守卫。使用范围：PDF 元素类型检查。解耦评估：通过 ./imports 转发。 */
import { isHTMLElement } from "./imports";
/** 用途：Canvas 截图获取。使用范围：PDF 区域截图。解耦评估：同目录模块。 */
import { getCaptureCanvas } from "./anno.getCaptureCanvas";
/** 用途：PDF 实例类型。使用范围：PDF 操作方法。解耦评估：同目录类型文件。 */
import { IPdfInstance } from "./anno.types";

/**
 * 获取元素所在PDF页面的信息
 *
 * @作用 从DOM元素向上查找包含该元素的PDF页面，并解析页码
 * @意图 为截图功能提供页面定位信息，便于从正确的PDF页面中提取图像
 * @调用时机 在需要获取注释区域所在页面时调用，如截图、复制等操作前
 *
 * @param element - 需要定位页面的DOM元素
 * @returns 包含页码的对象，如果找不到页面则返回null
 */
function getPageInfo(element: HTMLElement) {
    const pageElement = hasClosestByClassName(element, "page");
    if (!pageElement) {
        return null;
    }
    const pageNumberString = pageElement.getAttribute("data-page-number");
    if (!pageNumberString) {
        return null;
    }
    return { pageNumber: parseInt(pageNumberString) };
}

/**
 * 从PDF页面中提取矩形区域的图像数据
 *
 * @作用 根据矩形元素的位置和尺寸，从PDF页面的渲染画布中提取对应区域的ImageData
 * @意图 获取指定矩形注释区域的原始像素数据，为后续转换为图片提供基础
 * @调用时机 在 getRectImgData 中调用，作为截图流程的核心步骤
 * @问题/改进 scale常量硬编码为1.5，后续可考虑根据实际渲染比例动态获取
 *
 * @param pdfObj - PDF实例对象
 * @param pageNumber - 页码（从1开始）
 * @param rectElement - 矩形注释的DOM元素
 * @returns ImageData对象，失败时返回null
 */
async function extractRectImageData(pdfObj: IPdfInstance, pageNumber: number, rectElement: HTMLElement) {
    const captureCanvas = await getCaptureCanvas(pdfObj, pageNumber);
    const captureCanvasCtx = captureCanvas.getContext("2d");
    if (!captureCanvasCtx) {
        return null;
    }
    // 类型守卫：确保 firstElementChild 是 HTMLElement 才能访问 style 属性
    const firstChild = rectElement.firstElementChild;
    if (!isHTMLElement(firstChild)) {
        return null;
    }
    const rectStyle = firstChild.style;
    const scale = 1.5;

    // 确保所有参数都是整数，避免 "Value is not of type 'long'" 错误
    const x = Math.round(scale * parseFloat(rectStyle.left || "0"));
    const y = Math.round(scale * parseFloat(rectStyle.top || "0"));
    const width = Math.round(scale * parseFloat(rectStyle.width || "0"));
    const height = Math.round(scale * parseFloat(rectStyle.height || "0"));

    // 确保宽度和高度至少为1像素
    const finalWidth = Math.max(1, width);
    const finalHeight = Math.max(1, height);

    // 确保坐标在画布范围内
    const canvasWidth = captureCanvas.width;
    const canvasHeight = captureCanvas.height;
    const clampedX = Math.max(0, Math.min(x, canvasWidth - 1));
    const clampedY = Math.max(0, Math.min(y, canvasHeight - 1));
    const clampedWidth = Math.min(finalWidth, canvasWidth - clampedX);
    const clampedHeight = Math.min(finalHeight, canvasHeight - clampedY);

    return captureCanvasCtx.getImageData(clampedX, clampedY, clampedWidth, clampedHeight);
}

/**
 * 将ImageData转换为DataURL
 *
 * @作用 通过创建临时Canvas，将ImageData转换为base64编码的data URL
 * @意图 将像素数据转换为可用于显示、复制或下载的标准格式
 * @调用时机 在 getRectImgData 中调用，作为图像数据转换的最后一步
 *
 * @param imageData - 要转换的ImageData对象
 * @returns base64编码的data URL字符串
 */
function convertImageDataToDataUrl(imageData: ImageData) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
        ctx.putImageData(imageData, 0, 0);
    }
    return tempCanvas.toDataURL();
}

/**
 * 获取矩形注释区域的图片数据URL
 *
 * @作用 截取当前矩形注释区域的图像，返回base64格式的data URL
 * @意图 为复制、下载等功能提供图像数据
 * @调用时机 当需要获取注释区域图像时调用
 *
 * @param pdfObj - PDF实例对象
 * @returns 图像的data URL，失败时返回undefined
 */
export async function getRectImgData(pdfObj: IPdfInstance, annotationElement?: HTMLElement) {
    let target: HTMLElement | null | undefined = annotationElement;
    if (!target) {
        // 兼容旧调用：动态导入避免循环依赖
        const { rectElement: globalRect } = await import("./state/selection");
        target = globalRect as unknown as HTMLElement | null;
        if (!target) {
            return;
        }
    }
    const pageInfo = getPageInfo(target);
    if (!pageInfo) {
        return;
    }
    const captureImageData = await extractRectImageData(pdfObj, pageInfo.pageNumber, target);
    if (!captureImageData) {
        return;
    }

    return convertImageDataToDataUrl(captureImageData);
}

/**
 * 触发浏览器下载文件
 *
 * @作用 创建临时下载链接并触发点击，实现文件下载
 * @意图 将下载逻辑独立出来，便于复用
 * @调用时机 在需要下载文件时调用
 *
 * @param dataUrl - 文件的data URL
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
 * @调用时机 在下载PNG时调用
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
 * 下载PDF注释区域为PNG图片
 *
 * @作用 将当前选中的矩形注释区域截图并下载为PNG文件
 * @意图 让用户能够保存注释区域的截图到本地
 * @调用时机 当用户点击工具栏的"下载为PNG"按钮时调用
 *
 * @param pdfObj - PDF实例对象
 * @returns 下载成功返回true，失败返回false
 */
export async function downloadRectAsPng(pdfObj: IPdfInstance) {
    const dataUrl = await getRectImgData(pdfObj);
    if (!dataUrl) {
        return false;
    }

    const fileName = 生成下载文件名("annotation", "png");
    触发下载(dataUrl, fileName);
    return true;
}


