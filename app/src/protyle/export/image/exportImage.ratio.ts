/** 用途：导出图片上下文类型；使用范围：比例预览与分页导出流程；解耦评估：仅类型依赖，不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";
/**
 * 用途：导出图片比例选项。
 * 使用场景：构建导出弹窗中的比例下拉列表。
 * 关联函数：`buildExportImageRatioOptionsHtml`、`normalizeExportImageRatio`。
 * 问题/改进：后续若要支持“按分割线/按标题”这类模式，可继续在此扩展非比例型选项。
 */
export interface IExportImageRatioOption {
    value: string;
    label: string;
}
/**
 * 用途：导出图片文件描述。
 * 使用场景：按比例分页截图后返回多张图片及各自文件名。
 * 关联函数：`exportImageBlobsByRatio`。
 * 问题/改进：当前仅支持 PNG，后续若开放 JPEG/WebP 可继续扩展 MIME 信息。
 */
export interface IExportImageBlobFile {
    blob: Blob;
    fileName: string;
}
/**
 * 用途：html-to-image 最小能力约束。
 * 使用场景：比例分页导出时只需要 `toBlob` 能力。
 * 解耦评估：局部接口比直接依赖全局声明更利于测试与后续替换实现。
 */
export interface IExportImageBlobGenerator {
    toBlob: (element: Element) => Promise<Blob>;
}
/** 用途：自动模式值；使用范围：存储默认值与下拉选项。 */
export const EXPORT_IMAGE_RATIO_AUTO = "auto";
/** 用途：比例选项常量；使用范围：弹窗渲染、存储校验与导出分页。 */
export const EXPORT_IMAGE_RATIO_OPTIONS: IExportImageRatioOption[] = [
    {value: EXPORT_IMAGE_RATIO_AUTO, label: "自动"},
    {value: "1/1", label: "1:1"},
    {value: "4/3", label: "4:3"},
    {value: "3/4", label: "3:4"},
    {value: "16/9", label: "16:9"},
    {value: "9/16", label: "9:16"},
    {value: "3/2", label: "3:2"},
    {value: "2/3", label: "2:3"},
    {value: "16/10", label: "16:10 (平板/笔记本)"},
    {value: "10/16", label: "10:16 (平板竖屏)"},
    {value: "9/19.5", label: "9:19.5 (iPhone 竖屏)"},
    {value: "9/20", label: "9:20 (Android 竖屏)"},
    {value: "19.5/9", label: "19.5:9 (iPhone 横屏)"},
    {value: "20/9", label: "20:9 (Android 横屏)"},
];
/** 用途：合法比例值集合；使用范围：本地存储纠偏。 */
const EXPORT_IMAGE_RATIO_VALUE_SET = new Set(EXPORT_IMAGE_RATIO_OPTIONS.map((option) => option.value));
/**
 * 作用：构建比例下拉框选项 HTML。
 * 意图：把选项模板收敛到单点，避免弹窗模板中散落硬编码。
 * 调用时机：创建导出图片弹窗时。
 * 问题/改进：后续若接入 i18n，可在这里集中替换 label 来源。
 */
export const buildExportImageRatioOptionsHtml = (selectedRatio: string): string => {
    return EXPORT_IMAGE_RATIO_OPTIONS.map((option) => {
        const selected = option.value === selectedRatio ? " selected" : "";
        return `<option value="${option.value}"${selected}>${option.label}</option>`;
    }).join("");
};
/**
 * 作用：把未知值规范为受支持的比例选项。
 * 意图：兼容历史存储缺失或脏数据，避免下拉框出现非法状态。
 * 调用时机：读取 LOCAL_EXPORTIMG 配置时。
 * 问题/改进：如果未来选项量显著增加，可升级为 schema 校验器。
 */
export const normalizeExportImageRatio = (value: unknown, fallback = EXPORT_IMAGE_RATIO_AUTO): string => {
    if (typeof value !== "string") {
        return fallback;
    }
    if (!EXPORT_IMAGE_RATIO_VALUE_SET.has(value)) {
        return fallback;
    }
    return value;
};
/**
 * 作用：解析比例字符串为宽高数值。
 * 意图：为预览高度计算和分页导出提供统一的比例解析结果。
 * 调用时机：比例切换与确认导出时。
 * 问题/改进：当前仅支持 `宽/高` 结构，未来可扩展特殊模式值。
 */
export const parseExportImageRatio = (value: string): {width: number; height: number} | undefined => {
    if (!value || EXPORT_IMAGE_RATIO_AUTO === value || !value.includes("/")) {
        return undefined;
    }

    const [widthText, heightText] = value.split("/");
    const width = Number.parseFloat(widthText);
    const height = Number.parseFloat(heightText);
    if (!(width > 0) || !(height > 0)) {
        return undefined;
    }
    return {width, height};
};
/**
 * 作用：把当前比例应用到导出预览容器。
 * 意图：在不裁切内容的前提下，提前给用户一个“最小画布比例”的视觉反馈。
 * 调用时机：预览渲染完成后、比例下拉框切换后。
 * 问题/改进：当前为顶部对齐，后续可增加垂直居中预览策略。
 */
export const applyExportImageRatioPreview = (ctx: Pick<IExportImageContext, "exportImageElement" | "ratioElement">): void => {
    ctx.exportImageElement.style.removeProperty("min-height");

    const ratio = parseExportImageRatio(ctx.ratioElement.value);
    if (!ratio) {
        return;
    }
    const width = Math.ceil(ctx.exportImageElement.getBoundingClientRect().width);
    if (width <= 0) {
        return;
    }

    const height = Math.max(1, Math.ceil(width * ratio.height / ratio.width));
    ctx.exportImageElement.style.minHeight = `${height}px`;
};
/**
 * 作用：等待浏览器完成一帧布局。
 * 意图：确保离屏导出节点在截图前已经完成样式计算与尺寸更新。
 * 调用时机：离屏节点挂载后和每次分页切换显示内容后。
 * 问题/改进：后续可根据渲染稳定性改为双帧等待或资源加载检测。
 */
const waitForNextFrame = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
};
/**
 * 作用：为多图导出生成分页文件名。
 * 意图：在不改变基础标题语义的前提下，为每一页追加稳定序号。
 * 调用时机：按比例生成多张图片时。
 * 问题/改进：当前固定使用 `-01` 风格，后续可开放命名策略。
 */
const buildPagedFileName = (baseFileName: string, index: number, total: number): string => {
    if (total <= 1) {
        return baseFileName;
    }

    const dotIndex = baseFileName.lastIndexOf(".");
    const fileName = dotIndex >= 0 ? baseFileName.substring(0, dotIndex) : baseFileName;
    const extension = dotIndex >= 0 ? baseFileName.substring(dotIndex) : ".png";
    const serial = String(index + 1).padStart(Math.max(2, String(total).length), "0");
    return `${fileName}-${serial}${extension}`;
};
/**
 * 作用：创建离屏导出节点。
 * 意图：把分页导出与可见弹窗 DOM 解耦，避免导出时界面闪烁。
 * 调用时机：按比例确认导出时。
 * 问题/改进：当前通过 clone 复用现有 DOM，后续可改为更轻量的模板化导出节点。
 */
const createExportStage = (ctx: Pick<IExportImageContext, "contentElement" | "exportImageElement">) => {
    const stageWrapperElement = document.createElement("div");
    const stageElement = ctx.exportImageElement.cloneNode(true) as HTMLElement;
    const stagePreviewElement = stageElement.querySelector<HTMLElement>(".protyle-wysiwyg");
    if (!stagePreviewElement) {
        return;
    }
    const width = Math.ceil(ctx.exportImageElement.getBoundingClientRect().width);
    stageWrapperElement.style.position = "fixed";
    stageWrapperElement.style.left = "-100000px";
    stageWrapperElement.style.top = "0";
    stageWrapperElement.style.pointerEvents = "none";
    stageWrapperElement.style.zIndex = "-1";
    stageElement.style.margin = "0";
    stageElement.style.position = "relative";
    stageElement.style.left = "0";
    stageElement.style.top = "0";
    stageElement.style.width = `${width}px`;
    stageElement.style.maxWidth = `${width}px`;
    stageElement.style.boxSizing = "border-box";
    stageElement.style.backgroundColor = getComputedStyle(ctx.contentElement).backgroundColor;
    stageWrapperElement.appendChild(stageElement);
    document.body.appendChild(stageWrapperElement);
    return {stageWrapperElement, stageElement, stagePreviewElement};
};
/**
 * 作用：按最大可视高度切分预览子元素批次。
 * 意图：在保持块级边界完整的前提下，把长内容拆成多张比例一致的图片。
 * 调用时机：按比例确认导出时。
 * 问题/改进：单个块超高时会退化为“单页放下该块”，此时该页高度可能突破目标比例。
 */
const splitPreviewChildrenIntoBatches = (children: HTMLElement[], maxPreviewHeight: number): Array<{elements: HTMLElement[]; contentHeight: number}> => {
    const batches: Array<{elements: HTMLElement[]; contentHeight: number}> = [];
    let currentBatch: HTMLElement[] = [];
    let currentHeight = 0;

    for (const child of children) {
        const childHeight = Math.max(1, Math.ceil(child.getBoundingClientRect().height));

        if (0 === currentBatch.length) {
            currentBatch = [child];
            currentHeight = childHeight;
            if (childHeight > maxPreviewHeight) {
                batches.push({elements: currentBatch, contentHeight: currentHeight});
                currentBatch = [];
                currentHeight = 0;
            }
            continue;
        }

        if (currentHeight + childHeight > maxPreviewHeight) {
            batches.push({elements: currentBatch, contentHeight: currentHeight});
            currentBatch = [child];
            currentHeight = childHeight;
            if (childHeight > maxPreviewHeight) {
                batches.push({elements: currentBatch, contentHeight: currentHeight});
                currentBatch = [];
                currentHeight = 0;
            }
            continue;
        }

        currentBatch.push(child);
        currentHeight += childHeight;
    }

    if (0 < currentBatch.length) {
        batches.push({elements: currentBatch, contentHeight: currentHeight});
    }
    return batches;
};
/**
 * 作用：按选定比例把当前预览导出为一张或多张图片。
 * 意图：当内容超过目标比例高度时自动分页，避免“固定比例 = 内容被裁切”。
 * 调用时机：确认导出且选择了具体比例时。
 * 问题/改进：当前按顶层块分批，极端复杂块（超高表格/代码块）仍可能产生超高单页。
 */
export const exportImageBlobsByRatio = async (
    ctx: Pick<IExportImageContext, "id" | "contentElement" | "exportImageElement" | "ratioElement" | "confirmButton">,
    htmlToImage: IExportImageBlobGenerator,
): Promise<IExportImageBlobFile[]> => {
    const ratio = parseExportImageRatio(ctx.ratioElement.value);
    if (!ratio) {
        return [];
    }
    const stage = createExportStage(ctx);
    if (!stage) {
        return [];
    }

    const {stageWrapperElement, stageElement, stagePreviewElement} = stage;
    try {
        await waitForNextFrame();
        const frameWidth = Math.max(1, Math.ceil(stageElement.getBoundingClientRect().width));
        const frameChromeHeight = Math.max(0, Math.ceil(stageElement.getBoundingClientRect().height - stagePreviewElement.getBoundingClientRect().height));
        const targetFrameHeight = Math.max(1, Math.ceil(frameWidth * ratio.height / ratio.width));
        const maxPreviewHeight = Math.max(1, targetFrameHeight - frameChromeHeight);
        const childElements = Array.from(stagePreviewElement.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
        const fileName = ctx.confirmButton.getAttribute("data-title") || `${ctx.id}.png`;
        const originalDisplayMap = new Map<HTMLElement, string>();
        childElements.forEach((child) => {
            originalDisplayMap.set(child, child.style.display);
        });

        if (0 === childElements.length) {
            stagePreviewElement.style.height = `${maxPreviewHeight}px`;
            stagePreviewElement.style.maxHeight = `${maxPreviewHeight}px`;
            stagePreviewElement.style.overflow = "hidden";
            stageElement.style.height = `${targetFrameHeight}px`;
            stageElement.style.maxHeight = `${targetFrameHeight}px`;
            await waitForNextFrame();
            const blob = await htmlToImage.toBlob(stageElement);
            return blob ? [{blob, fileName}] : [];
        }
        const batches = splitPreviewChildrenIntoBatches(childElements, maxPreviewHeight);
        childElements.forEach((child) => {
            child.style.display = "none";
        });
        const files: IExportImageBlobFile[] = [];
        for (const [index, batch] of batches.entries()) {
            childElements.forEach((child) => {
                child.style.display = "none";
            });
            batch.elements.forEach((child) => {
                child.style.display = originalDisplayMap.get(child) || "";
            });
            const previewHeight = Math.max(maxPreviewHeight, Math.ceil(batch.contentHeight));
            const frameHeight = previewHeight + frameChromeHeight;
            stagePreviewElement.style.height = `${previewHeight}px`;
            stagePreviewElement.style.maxHeight = `${previewHeight}px`;
            stagePreviewElement.style.overflow = "hidden";
            stageElement.style.height = `${frameHeight}px`;
            stageElement.style.maxHeight = `${frameHeight}px`;

            await waitForNextFrame();
            const blob = await htmlToImage.toBlob(stageElement);
            if (blob) {
                files.push({
                    blob,
                    fileName: buildPagedFileName(fileName, index, batches.length),
                });
            }
        }
        return files;
    } finally {
        stageWrapperElement.remove();
    }
};
