/** 用途：导出预览网络请求；使用范围：导出图片初始化与 keepFold 切换；解耦评估：预览请求与渲染从主流程拆分后更易测试。 */
import {fetchPost} from "./imports";
/** 用途：代码高亮渲染；使用范围：预览内容更新后进行语法高亮；解耦评估：渲染基础能力，直接复用更稳定。 */
import {highlightRender} from "./imports";
/** 用途：内容渲染注册表；使用范围：预览内容更新后批量渲染嵌入组件；解耦评估：渲染编排核心能力应保持集中。 */
import {contentRendererRegistry} from "./imports";
/** 用途：导出图片水印刷新；使用范围：预览更新后同步水印层；解耦评估：通过独立模块保持单一职责。 */
import {updateExportImageWatermark} from "./exportImage.watermark";
/** 用途：导出比例预览刷新；使用范围：预览内容更新后同步最小画布比例；解耦评估：比例逻辑独立模块更便于复用。 */
import {applyExportImageRatioPreview} from "./exportImage.ratio";
/** 用途：导出图片上下文类型；使用范围：请求与渲染链路参数约束；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";

/** 作用：设置导出弹窗的加载状态。意图：统一按钮禁用与 loading 显示逻辑。调用时机：请求预览前后。 */
const setPreviewLoadingState = (ctx: IExportImageContext, loading: boolean): void => {
    const loadingElement = ctx.rootElement.querySelector(".fn__loading");

    if (loading) {
        ctx.cancelButton.setAttribute("disabled", "disabled");
        ctx.confirmButton.setAttribute("disabled", "disabled");
    }

    // 当进入 loading 且页面尚未存在加载节点时，才插入 loading，避免重复渲染占位图。
    if (loading && !loadingElement && ctx.confirmButton.parentElement) {
        ctx.confirmButton.parentElement.insertAdjacentHTML("afterend", '<div class="fn__loading"><img height="128px" width="128px" src="stage/loading-pure.svg"></div>');
        return;
    }

    if (loading) {
        return;
    }

    ctx.cancelButton.removeAttribute("disabled");
    ctx.confirmButton.removeAttribute("disabled");
    if (loadingElement) {
        loadingElement.remove();
    }
};

/** 作用：等比缩放超宽表格。意图：避免导出图片中表格横向溢出。调用时机：预览渲染后。 */
const scaleWideTables = (previewElement: HTMLElement): void => {
    for (const tableElement of previewElement.querySelectorAll<HTMLElement>("table")) {
        const parentElement = tableElement.parentElement;
        if (!parentElement) {
            continue;
        }
        if (tableElement.clientWidth <= parentElement.clientWidth) {
            continue;
        }
        const scale = parentElement.clientWidth / tableElement.clientWidth;
        const marginBottom = parentElement.clientWidth * tableElement.clientHeight / tableElement.clientWidth - parentElement.clientHeight + 1;
        tableElement.setAttribute("style", `margin-bottom:${marginBottom}px;transform: scale(${scale});transform-origin: top left;`);
        parentElement.style.overflow = "hidden";
    }
};

/** 作用：写入并渲染预览内容。意图：集中处理 DOM 更新与渲染副作用。调用时机：预览接口成功后。 */
const renderPreview = async (ctx: IExportImageContext, response: IWebSocketData): Promise<void> => {
    const previewData = response.data ?? {};
    ctx.previewElement.innerHTML = previewData.content || "";
    ctx.previewElement.setAttribute("data-doc-type", previewData.type || "NodeDocument");

    const attrs = previewData.attrs;
    // attrs 在历史文档或异常响应中可能缺失/非对象，需先做结构校验后再批量写入 DOM 属性。
    if (attrs && typeof attrs === "object") {
        for (const [key, value] of Object.entries(attrs)) {
            if (typeof value === "string") {
                ctx.previewElement.setAttribute(key, value);
            }
        }
    }

    for (const codeBlockElement of ctx.previewElement.querySelectorAll<HTMLElement>(".code-block")) {
        codeBlockElement.setAttribute("linewrap", "true");
    }

    contentRendererRegistry.renderBatch(ctx.previewElement);
    highlightRender(ctx.previewElement);
    scaleWideTables(ctx.previewElement);
    await applyExportImageRatioPreview(ctx);
    await updateExportImageWatermark(ctx);
};

/**
 * 作用：请求导出图片预览并刷新 UI。
 * 意图：把网络请求、渲染与 loading 状态收拢到单一可复用函数。
 * 调用时机：初始化预览与 keepFold 切换时。
 * 问题/改进：后续可增加请求取消控制，避免高频切换导致旧响应覆盖新状态。
 */
// 导出语句注释：导出图片预览请求入口。
const createPreviewResponseHandler = (
    ctx: IExportImageContext,
    onSuccess: ((response: IWebSocketData) => void) | undefined,
    resolve: () => void,
) => {
    return async (response: IWebSocketData): Promise<void> => {
        await renderPreview(ctx, response);
        const exportName = response.data?.name?.trim() || ctx.id;
        ctx.confirmButton.setAttribute("data-title", `${exportName}.png`);
        onSuccess?.(response);
        resolve();
    };
};

/**
 * 作用：请求导出图片预览并刷新 UI。
 * 意图：把网络请求、渲染与 loading 状态收拢到单一可复用函数。
 * 调用时机：初始化预览与 keepFold 切换时。
 * 问题/改进：后续可增加请求取消控制，避免高频切换导致旧响应覆盖新状态。
 */
// 导出语句注释：导出图片预览请求入口。
export const requestExportImagePreview = async (
    ctx: IExportImageContext,
    onSuccess?: (response: IWebSocketData) => void,
): Promise<void> => {
    setPreviewLoadingState(ctx, true);

    await new Promise<void>((resolve) => {
        const handleResponse = createPreviewResponseHandler(ctx, onSuccess, resolve);
        fetchPost("/api/export/exportPreviewHTML", {
            id: ctx.id,
            keepFold: ctx.keepFoldElement.checked,
            image: true,
        }, handleResponse);
    });

    setPreviewLoadingState(ctx, false);
};
