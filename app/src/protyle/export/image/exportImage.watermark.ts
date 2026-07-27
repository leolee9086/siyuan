/** 用途：动态脚本加载；使用范围：确保 html-to-image 已注入；解耦评估：基础设施依赖，复用优于重复实现。 */
import {addScript} from "./imports";
/** 用途：常量集合；使用范围：拼接 PROTYLE_CDN 资源路径；解耦评估：全局常量依赖，不应硬编码。 */
import {Constants} from "./imports";
/** 用途：全局配置读取；使用范围：读取水印描述与文本配置；解耦评估：经 environment 封装已解耦 window。 */
import {getSafeSiyuanConfig} from "./imports";
/** 用途：html-to-image 访问器；使用范围：文本水印转 canvas；解耦评估：经 environment 封装避免业务直接访问 window。 */
import {getHtmlToImage} from "./imports";
/** 用途：导出图片上下文类型；使用范围：水印更新流程参数；解耦评估：类型依赖无运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";

/**
 * 作用：刷新导出图片水印层。
 * 意图：将水印逻辑拆分为独立模块，降低主流程函数复杂度。
 * 调用时机：预览刷新完成后、watermark 开关变化后。
 * 问题/改进：可引入缓存避免重复生成相同文本水印画布。
 */
// 导出语句注释：导出图片水印更新入口。
export const updateExportImageWatermark = async (ctx: IExportImageContext) => {
    const preview = ctx.watermarkPreviewElement;
    preview.innerHTML = "";

    // 关闭水印时必须清空 style，避免残留覆盖层。
    if (!ctx.watermarkElement.checked) {
        preview.removeAttribute("style");
        return;
    }

    const exportConfig = getSafeSiyuanConfig()?.export;
    const watermarkDesc = exportConfig?.imageWatermarkDesc;
    if (watermarkDesc) {
        preview.innerHTML = watermarkDesc;
        return;
    }

    const watermarkText = exportConfig?.imageWatermarkStr;
    if (!watermarkText) {
        return;
    }

    // URL 水印可直接平铺背景图，无需二次绘制。
    if (watermarkText.startsWith("http")) {
        preview.setAttribute("style", `background-image: url(${watermarkText});background-repeat: repeat;position: absolute;top: 0;left: 0;width: 100%;height: 100%;border-radius: var(--b3-border-radius-b);`);
        return;
    }

    await addScript(`${Constants.PROTYLE_CDN}/js/html-to-image.min.js?v=1.11.13`, "protyleHtml2image");
    const htmlToImage = await getHtmlToImage();
    if (!htmlToImage) {
        return;
    }

    const toCanvas = Reflect.get(htmlToImage, "toCanvas");
    if (typeof toCanvas !== "function") {
        return;
    }

    const width = Math.max(ctx.exportImageElement.clientWidth / 3, 150);
    preview.setAttribute("style", `width: ${width}px;height: ${width}px;display: flex;justify-content: center;align-items: center;color: var(--b3-border-color);font-size: 14px;`);
    preview.innerHTML = `<div style="transform: rotate(-45deg)">${watermarkText}</div>`;
    const canvasCandidate = await Reflect.apply(toCanvas, htmlToImage, [preview]);
    if (!(canvasCandidate instanceof HTMLCanvasElement)) {
        return;
    }
    preview.innerHTML = "";
    preview.setAttribute("style", `background-image: url(${canvasCandidate.toDataURL("image/png")});background-repeat: repeat;position: absolute;top: 0;left: 0;width: 100%;height: 100%;border-radius: var(--b3-border-radius-b);`);
};
