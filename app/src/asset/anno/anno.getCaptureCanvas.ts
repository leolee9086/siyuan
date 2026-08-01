import type { IPdfInstance, IPDF页面渲染参数 } from "./anno.types";
import { getPdfToCssUnits } from "../../util/siyuanEnvironments/pdfjsLib.environment";

/**
 * 获取PDF页面渲染参数
 *
 * @作用 从PDF文档中获取指定页面及其视口参数
 * @意图 将数据获取逻辑独立出来，便于复用和测试
 * @调用时机 在需要渲染PDF页面之前调用，获取渲染所需的基础数据
 *
 * @param pdfObj - PDF实例对象，包含pdfDocument和pdfViewer
 * @param pageNumber - 要获取的页码（从1开始）
 * @returns PDF页面对象和视口参数
 */
const 获取PDF页面渲染参数 = async (pdfObj: IPdfInstance, pageNumber: number) => {
    const pdfPage = await pdfObj.pdfDocument.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: 1.5 * pdfObj.pdfViewer.currentScale * getPdfToCssUnits() });
    return { pdfPage, viewport };
};

/**
 * 将PDF页面渲染到canvas
 *
 * @作用 根据渲染参数创建canvas并渲染PDF页面内容
 * @意图 将canvas创建和渲染逻辑独立出来，便于复用
 * @调用时机 在获取到PDF页面渲染参数后调用
 *
 * @param 参数 - 包含pdfPage和viewport的渲染参数
 * @returns 渲染完成的canvas元素
 */
const 渲染PDF页面到Canvas = async (参数: IPDF页面渲染参数)=> {
    const { pdfPage, viewport } = 参数;
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
        return canvas;
    }

    await pdfPage.render({
        canvasContext,
        viewport: viewport
    }).promise;

    return canvas;
};

/**
 * 获取用于截图的PDF页面canvas
 *
 * @作用 将指定PDF页面渲染到一个canvas元素上，用于后续截图操作
 * @意图 PDF注释功能需要对页面进行截图，此函数提供渲染后的canvas供截图使用
 * @调用时机 当用户在PDF上框选矩形区域创建注释时，需要从canvas中提取该区域的图像数据
 *
 * @param pdfObj - PDF实例对象，包含pdfDocument和pdfViewer
 * @param pageNumber - 要渲染的页码（从1开始）
 * @returns 渲染完成的canvas元素
 */
export const getCaptureCanvas = async (pdfObj: IPdfInstance, pageNumber: number)=> {
    const 渲染参数 = await 获取PDF页面渲染参数(pdfObj, pageNumber);
    return 渲染PDF页面到Canvas(渲染参数);
};
