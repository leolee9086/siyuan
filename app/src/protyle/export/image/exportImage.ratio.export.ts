/** 用途：导出图片文件描述类型；使用范围：比例分页导出的返回值约束。 */
import type {IExportImageBlobFile} from "./exportImage.types";
/** 用途：html-to-image 截图运行时与选项类型；使用范围：比例分页截图依赖注入。 */
import type {IExportImageCapture} from "./exportImage.types";
/** 用途：导出图片上下文类型；使用范围：比例分页导出流程参数约束。 */
import type {IExportImageContext} from "./exportImage.types";
/** 用途：比例字符串解析函数；使用范围：分页导出前解析宽高比；解耦评估：解析规则集中在 ratio 模块后，此处直接复用可避免重复实现。 */
import {parseExportImageRatio} from "./exportImage.ratio";

/** 作用：等待浏览器完成一帧布局。意图：确保离屏节点截图前尺寸已稳定。 */
const waitForNextFrame = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
};

/** 作用：生成分页文件名。意图：为多图导出追加稳定序号。 */
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

/** 作用：创建离屏导出节点。意图：把分页导出与可见弹窗 DOM 解耦。 */
const createExportStage = (ctx: Pick<IExportImageContext, "contentElement" | "exportImageElement">) => {
    const stageWrapperElement = document.createElement("div");
    const stageCloneNode = ctx.exportImageElement.cloneNode(true);
    if (!(stageCloneNode instanceof HTMLElement)) {
        return;
    }
    const stagePreviewElement = stageCloneNode.querySelector<HTMLElement>(".protyle-wysiwyg");
    if (!stagePreviewElement) {
        return;
    }

    const width = Math.ceil(ctx.exportImageElement.getBoundingClientRect().width);
    stageWrapperElement.style.position = "fixed";
    stageWrapperElement.style.left = "-100000px";
    stageWrapperElement.style.top = "0";
    stageWrapperElement.style.pointerEvents = "none";
    stageWrapperElement.style.zIndex = "-1";
    stageCloneNode.style.margin = "0";
    stageCloneNode.style.position = "relative";
    stageCloneNode.style.left = "0";
    stageCloneNode.style.top = "0";
    stageCloneNode.style.width = `${width}px`;
    stageCloneNode.style.maxWidth = `${width}px`;
    stageCloneNode.style.boxSizing = "border-box";
    stageCloneNode.style.backgroundColor = getComputedStyle(ctx.exportImageElement).backgroundColor;
    stageWrapperElement.appendChild(stageCloneNode);
    document.body.appendChild(stageWrapperElement);
    return {stageWrapperElement, stageElement: stageCloneNode, stagePreviewElement};
};

/** 作用：提取可参与分页的块级元素。意图：过滤非 HTMLElement 子节点。 */
const collectPreviewChildren = (stagePreviewElement: HTMLElement): HTMLElement[] => {
    const childElements: HTMLElement[] = [];
    for (const child of Array.from(stagePreviewElement.children)) {
        // 仅真实元素节点参与高度测量，避免非元素子节点干扰分页计算。
        if (child instanceof HTMLElement) {
            childElements.push(child);
        }
    }
    return childElements;
};

/** 作用：记录原始 display 样式。意图：分页显隐后可准确恢复展示状态。 */
const createOriginalDisplayMap = (childElements: HTMLElement[]): Map<HTMLElement, string> => {
    const originalDisplayMap = new Map<HTMLElement, string>();
    for (const child of childElements) {
        originalDisplayMap.set(child, child.style.display);
    }
    return originalDisplayMap;
};

/** 作用：批量隐藏预览子元素。意图：切页前先清空上一页残留内容。 */
const hidePreviewChildren = (childElements: HTMLElement[]): void => {
    for (const child of childElements) {
        child.style.display = "none";
    }
};

/** 作用：恢复当前批次元素显示。意图：让当前页仅展示所属块内容。 */
const restoreBatchDisplay = (elements: HTMLElement[], originalDisplayMap: Map<HTMLElement, string>): void => {
    for (const child of elements) {
        child.style.display = originalDisplayMap.get(child) || "";
    }
};

/** 作用：更新离屏舞台高度。意图：统一维护预览区与画布高度设置。 */
const applyStageFrameSize = (
    stageElement: HTMLElement,
    stagePreviewElement: HTMLElement,
    previewHeight: number,
    frameHeight: number,
): void => {
    stagePreviewElement.style.height = `${previewHeight}px`;
    stagePreviewElement.style.maxHeight = `${previewHeight}px`;
    stagePreviewElement.style.overflow = "hidden";
    stageElement.style.height = `${frameHeight}px`;
    stageElement.style.maxHeight = `${frameHeight}px`;
};

/** 作用：计算离屏导出的关键尺寸。意图：集中处理目标比例与 chrome 高度。 */
const getStageMetrics = (
    stageElement: HTMLElement,
    stagePreviewElement: HTMLElement,
    ratio: {width: number; height: number},
): {frameChromeHeight: number; maxPreviewHeight: number; targetFrameHeight: number} => {
    const frameWidth = Math.max(1, Math.ceil(stageElement.getBoundingClientRect().width));
    const frameChromeHeight = Math.max(0, Math.ceil(stageElement.getBoundingClientRect().height - stagePreviewElement.getBoundingClientRect().height));
    const targetFrameHeight = Math.max(1, Math.ceil(frameWidth * ratio.height / ratio.width));
    const maxPreviewHeight = Math.max(1, targetFrameHeight - frameChromeHeight);
    return {frameChromeHeight, maxPreviewHeight, targetFrameHeight};
};

/** 作用：以单个块开启新页。意图：统一处理首块与超高单块逻辑。 */
const startBatchWithChild = (
    batches: Array<{elements: HTMLElement[]; contentHeight: number}>,
    child: HTMLElement,
    childHeight: number,
    maxPreviewHeight: number,
): {currentBatch: HTMLElement[]; currentHeight: number} => {
    const currentBatch = [child];

    // 单个块已经高于目标页高时，它必须立即独占一页。
    if (childHeight > maxPreviewHeight) {
        batches.push({elements: currentBatch, contentHeight: childHeight});
        return {currentBatch: [], currentHeight: 0};
    }

    return {currentBatch, currentHeight: childHeight};
};

/** 作用：按最大可视高度切分批次。意图：保持块级边界完整。 */
const splitPreviewChildrenIntoBatches = (children: HTMLElement[], maxPreviewHeight: number): Array<{elements: HTMLElement[]; contentHeight: number}> => {
    const batches: Array<{elements: HTMLElement[]; contentHeight: number}> = [];
    let currentBatch: HTMLElement[] = [];
    let currentHeight = 0;

    for (const child of children) {
        const childHeight = Math.max(1, Math.ceil(child.getBoundingClientRect().height));

        // 第一块内容需要直接开启新批次，作为当前页起点。
        if (0 === currentBatch.length) {
            ({currentBatch, currentHeight} = startBatchWithChild(batches, child, childHeight, maxPreviewHeight));
            continue;
        }

        // 再加入该块会超出页高时，需要先提交当前页，再开启下一页。
        if (currentHeight + childHeight > maxPreviewHeight) {
            batches.push({elements: currentBatch, contentHeight: currentHeight});
            ({currentBatch, currentHeight} = startBatchWithChild(batches, child, childHeight, maxPreviewHeight));
            continue;
        }

        currentBatch.push(child);
        currentHeight += childHeight;
    }

    // 循环结束后仍保留的批次尚未入列，需要补入最后一页。
    if (0 < currentBatch.length) {
        batches.push({elements: currentBatch, contentHeight: currentHeight});
    }
    return batches;
};

/** 作用：导出单张比例图片。意图：覆盖空预览或无需分页的场景。 */
const exportSingleStageBlob = async (
    stageElement: HTMLElement,
    stagePreviewElement: HTMLElement,
    maxPreviewHeight: number,
    targetFrameHeight: number,
    capture: IExportImageCapture,
    fileName: string,
): Promise<IExportImageBlobFile[]> => {
    applyStageFrameSize(stageElement, stagePreviewElement, maxPreviewHeight, targetFrameHeight);
    await waitForNextFrame();
    const blob = await capture.runtime.toBlob(stageElement, capture.options);
    return blob ? [{blob, fileName}] : [];
};

/** 作用：按批次截图生成多张图片。意图：收拢分页显隐与逐页截图流程。 */
const exportPagedStageBlobs = async (
    stageElement: HTMLElement,
    stagePreviewElement: HTMLElement,
    childElements: HTMLElement[],
    batches: Array<{elements: HTMLElement[]; contentHeight: number}>,
    originalDisplayMap: Map<HTMLElement, string>,
    frameChromeHeight: number,
    maxPreviewHeight: number,
    capture: IExportImageCapture,
    fileName: string,
): Promise<IExportImageBlobFile[]> => {
    hidePreviewChildren(childElements);
    const files: IExportImageBlobFile[] = [];
    for (const [index, batch] of batches.entries()) {
        hidePreviewChildren(childElements);
        restoreBatchDisplay(batch.elements, originalDisplayMap);
        const previewHeight = Math.max(maxPreviewHeight, Math.ceil(batch.contentHeight));
        const frameHeight = previewHeight + frameChromeHeight;
        applyStageFrameSize(stageElement, stagePreviewElement, previewHeight, frameHeight);
        await waitForNextFrame();
        const blob = await capture.runtime.toBlob(stageElement, capture.options);
        if (blob) {
            files.push({
                blob,
                fileName: buildPagedFileName(fileName, index, batches.length),
            });
        }
    }
    return files;
};

/** 作用：在离屏舞台执行比例导出。意图：集中管理尺寸计算与清理逻辑。 */
const exportStageBlobs = async (
    ctx: Pick<IExportImageContext, "id" | "confirmButton">,
    stage: {stageWrapperElement: HTMLElement; stageElement: HTMLElement; stagePreviewElement: HTMLElement},
    ratio: {width: number; height: number},
    capture: IExportImageCapture,
): Promise<IExportImageBlobFile[]> => {
    const {stageWrapperElement, stageElement, stagePreviewElement} = stage;
    try {
        await waitForNextFrame();
        const {frameChromeHeight, maxPreviewHeight, targetFrameHeight} = getStageMetrics(stageElement, stagePreviewElement, ratio);
        const childElements = collectPreviewChildren(stagePreviewElement);
        const fileName = ctx.confirmButton.getAttribute("data-title") || `${ctx.id}.png`;

        // 空预览场景仍需导出一张满足比例的图片，避免结果为空。
        if (0 === childElements.length) {
            return await exportSingleStageBlob(stageElement, stagePreviewElement, maxPreviewHeight, targetFrameHeight, capture, fileName);
        }

        const originalDisplayMap = createOriginalDisplayMap(childElements);
        const batches = splitPreviewChildrenIntoBatches(childElements, maxPreviewHeight);
        return await exportPagedStageBlobs(stageElement, stagePreviewElement, childElements, batches, originalDisplayMap, frameChromeHeight, maxPreviewHeight, capture, fileName);
    } finally {
        stageWrapperElement.remove();
    }
};

/** 作用：按选定比例导出一张或多张图片。意图：内容过长时自动分页避免裁切。 */
export const exportImageBlobsByRatio = async (
    ctx: Pick<IExportImageContext, "id" | "contentElement" | "exportImageElement" | "ratioElement" | "confirmButton">,
    capture: IExportImageCapture,
): Promise<IExportImageBlobFile[]> => {
    const ratio = await parseExportImageRatio(ctx.ratioElement.value);
    if (!ratio) {
        return [];
    }

    const stage = createExportStage(ctx);
    if (!stage) {
        return [];
    }

    return await exportStageBlobs(ctx, stage, ratio, capture);
};
