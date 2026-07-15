/** 用途：导出流程常量；使用范围：读取 LOCAL_EXPORTIMG 持久化键；解耦评估：常量依赖集中管理，禁止硬编码替代。 */
import {Constants} from "./imports";
/** 用途：动态加载脚本；使用范围：按需加载 html-to-image；解耦评估：基础设施函数，直接复用最稳定。 */
import {addScript} from "./imports";
/** 用途：网络请求；使用范围：提交导出文件到后端；解耦评估：网络基础能力，业务层直接调用可读性最佳。 */
import {fetchPost} from "./imports";
/** 用途：访问 html-to-image 运行时对象；使用范围：截图转换；解耦评估：通过 environment 封装避免 window 直连。 */
import {getHtmlToImage} from "./imports";
/** 用途：隐藏消息；使用范围：导出结束时收口提示；解耦评估：UI 基础能力直接调用成本最低。 */
import {hideMessage} from "./imports";
/** 用途：iPhone 判断；使用范围：截图预热兼容逻辑；解耦评估：平台工具函数可复用。 */
import {isIPhone} from "./imports";
/** 用途：移动端判断；使用范围：导出容器宽度适配；解耦评估：平台工具函数可复用。 */
import {isMobile} from "./imports";
/** 用途：Safari 判断；使用范围：截图预热兼容逻辑；解耦评估：平台工具函数可复用。 */
import {isSafari} from "./imports";
/** 用途：保存导出文件；使用范围：导出成功后打开或保存生成文件；解耦评估：兼容层能力，避免业务重复实现。 */
import {saveExportFile} from "./imports";
/** 用途：存储持久化；使用范围：保存导出选项；解耦评估：基础设施函数，直接调用最简洁。 */
import {setStorageVal} from "./imports";
/** 用途：展示消息；使用范围：导出进行中与失败提示；解耦评估：UI 基础能力直接调用。 */
import {showMessage} from "./imports";
/** 用途：国际化文案；使用范围：导出消息文本；解耦评估：全局 i18n 服务直接依赖符合项目约束。 */
import {siyuanI18n} from "./imports";
/** 用途：比例分页导出；使用范围：选择具体比例时生成多张图片；解耦评估：截图分页逻辑独立模块更利于后续扩展。 */
import {exportImageBlobsByRatio} from "./exportImage.ratio.export";
/** 用途：导出图片上下文类型；使用范围：确认导出流程参数；解耦评估：类型依赖无运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";

/** 作用：内联 PlantUML object 内容。意图：确保截图阶段图表可见。调用时机：截图前。问题/改进：当前为串行请求。 */
const inlinePlantumlObjects = async (previewElement: HTMLElement)=> {
    for (const plantumlElement of previewElement.querySelectorAll("[data-subtype='plantuml']")) {
        const objectElement = plantumlElement.querySelector("object");
        if (!objectElement) {
            continue;
        }
        const dataUrl = objectElement.getAttribute("data");
        if (!dataUrl) {
            continue;
        }
        const response = await fetch(dataUrl);
        objectElement.insertAdjacentHTML("beforebegin", await response.text());
        objectElement.remove();
    }
};

/** 作用：重排代码块行号。意图：保证导出图片行号连续。调用时机：截图前。问题/改进：仅覆盖行号 DOM 选择器。 */
const normalizeLineNumber = (previewElement: HTMLElement) => {
    let lineNumber = 1;
    for (const lineElement of previewElement.querySelectorAll<HTMLElement>(".protyle-linenumber__rows span")) {
        lineElement.textContent = `${lineNumber}`;
        lineNumber += 1;
    }
};

/**
 * 作用：上传导出的图片文件并触发打开。
 * 意图：把表单构造与上传副作用封装成 Promise，便于多图顺序导出。
 * 调用时机：截图 blob 生成完成后。
 * 问题/改进：当前后端接口只返回单文件 URL，后续可扩展批量上传接口减少往返次数。
 */
const uploadExportImageBlob = async (blob: Blob, fileName: string, msgId: string)=> {
    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("type", "image/png");

    await new Promise<void>((resolve) => {
        fetchPost("/api/export/exportAsFile", formData, (response) => {
            saveExportFile(response.data.file, msgId);
            resolve();
        });
    });
};

/**
 * 作用：处理“确认导出”按钮逻辑。
 * 意图：将截图与上传流程从 orchestrator 文件中拆分，降低单文件复杂度。
 * 调用时机：用户点击导出弹窗确认按钮时。
 * 问题/改进：后端回调链路可进一步 Promise 化。
 */
// 导出语句注释：确认导出流程执行器。
export const handleConfirmExport = async (ctx: IExportImageContext)=> {
    const msgId = showMessage(siyuanI18n.exporting, 0);
    ctx.containerElement.style.height = "";

    // 移动端下需放宽容器宽度，避免截图裁切。
    if (isMobile()) {
        ctx.containerElement.style.width = "100vw";
    }

    ctx.contentElement.style.overflow = "hidden";
    setStorageVal(Constants.LOCAL_EXPORTIMG, ctx.storage);
    await inlinePlantumlObjects(ctx.previewElement);
    normalizeLineNumber(ctx.previewElement);

    await addScript(`${Constants.PROTYLE_CDN}/js/html-to-image.min.js?v=1.11.13`, "protyleHtml2image");
    const htmlToImage = await getHtmlToImage();
    if (!htmlToImage) {
        hideMessage(msgId);
        showMessage(siyuanI18n._kernel[14], 3000, "error");
        return;
    }

    // 预热同样需要针对最终导出节点执行，避免背景图只出现在预览里却未进入截图管线。
    // iPhone/Safari 首次截图偶现不完整，需预热渲染管线。
    if (isIPhone() || isSafari()) {
        await htmlToImage.toBlob(ctx.exportImageElement);
        await htmlToImage.toBlob(ctx.exportImageElement);
        await htmlToImage.toBlob(ctx.exportImageElement);
    }

    const ratioFiles = await exportImageBlobsByRatio(ctx, htmlToImage);
    // 选择了具体比例且内容被分页时，优先上传分页结果，避免再回退到整图导出。
    if (0 < ratioFiles.length) {
        for (const file of ratioFiles) {
            await uploadExportImageBlob(file.blob, file.fileName, msgId);
        }
        ctx.finish();
        return;
    }

    // 自动比例导出也必须截图带背景的画布节点，而不是外围内容容器。
    const blob = await htmlToImage.toBlob(ctx.exportImageElement);
    await uploadExportImageBlob(blob, ctx.confirmButton.getAttribute("data-title") || `${ctx.id}.png`, msgId);

    ctx.finish();
};
