/** 用途：拖拽阈值常量。使用范围：矩形标注拖拽/缩放的最小移动判定。解耦评估：纯常量，通过 ./imports 转发更合适，但此处直接引用全局常量更清晰。 */
import { Constants } from "../../constants";
/** 用途：查找最近的 page 祖先。使用范围：定位标注所在 PDF 页面。解耦评估：通用 DOM 工具，通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：获取标注配置。使用范围：拖拽结束时持久化位置。解耦评估：配置读写是模块核心，直接导入。 */
import { getConfig } from "./config";
/** 用途：网络请求。使用范围：保存标注。解耦评估：基础设施，直接导入。 */
import { fetchPost } from "./imports";
/** 用途：几何辅助。使用范围：矩形缩放/移动计算。解耦评估：纯函数，无耦合。 */
import { moveRectBounds, resizeRectBounds } from "../rectAnnotationResize";
/** 用途：几何类型。使用范围：拖拽/缩放边界类型。解耦评估：纯类型。 */
import type { RectBounds, RectResizeDirection } from "../rectAnnotationResize";
/** 用途：PDF 实例类型。使用范围：标注拖拽。解耦评估：纯类型。 */
import type { IPdfAnno, IPdfInstance, IPdfPageView, IPdfViewport } from "./anno.types";
/** 用途：显示工具栏。使用范围：拖拽开始时选中标注。解耦评估：同目录模块，单向依赖。 */
import { showToolbar } from "./anno.showToolbar";

const RECT_RESIZE_MIN_SIZE = 8;

/** 判定是否为矩形标注元素。 */
const isRectAnnotationElement = (element: HTMLElement): boolean => {
    const mode = element.dataset.mode;
    const content = element.dataset.content || "";
    const isRect = mode === "rect";
    const isCompatibleRect = mode === "" && element.childElementCount === 1 &&
        /-P\d+-\d{14}-\w{7}$/.test(content);
    return isRect || isCompatibleRect;
};

const hideToolbarMenu = (element: HTMLElement) => {
    element.querySelector(".pdf__util")?.classList.add("fn__none");
};

/** 将 PDF 坐标转换为视口坐标并写入标注元素。 */
const setRectPosition = (
    element: HTMLElement,
    page: IPdfPageView,
    rect: number[],
    viewport: IPdfViewport = page.viewport.clone({ rotation: 0 }),
) => {
    const bounds = viewport.convertToViewportRectangle(rect);
    const width = Math.abs(bounds[0] - bounds[2]);
    if (width <= 0) {
        return false;
    }
    element.style.left = `${Math.min(bounds[0], bounds[2])}px`;
    element.style.top = `${Math.min(bounds[1], bounds[3])}px`;
    element.style.width = `${width}px`;
    element.style.height = `${Math.abs(bounds[1] - bounds[3])}px`;
    return true;
};

const getPageViewInfo = (target: HTMLElement, pdf: IPdfInstance) => {
    const rawElement = hasClosestByClassName(target, "page");
    if (!(rawElement instanceof HTMLElement)) {
        return null;
    }
    const pageIndex = parseInt(rawElement.getAttribute("data-page-number") || "0", 10) - 1;
    const page = pdf.pdfViewer.getPageView(pageIndex);
    if (!page) {
        return null;
    }
    return { page, pageIndex };
};

const createBounds = (
    annotationElement: HTMLElement,
    page: IPdfPageView,
): { initial: RectBounds; boundary: RectBounds } => {
    const targetRect = annotationElement.getBoundingClientRect();
    const canvasRect = page.canvas.getBoundingClientRect();
    return {
        initial: {
            left: targetRect.left,
            top: targetRect.top,
            right: targetRect.right,
            bottom: targetRect.bottom,
        },
        boundary: {
            left: canvasRect.left,
            top: canvasRect.top,
            right: canvasRect.right,
            bottom: canvasRect.bottom,
        },
    };
};

const persistPosition = (
    pdf: IPdfInstance,
    target: HTMLElement,
    pageIndex: number,
    position: number[],
) => {
    const config: Record<string, IPdfAnno> = getConfig(pdf);
    const id = target.getAttribute("data-node-id");
    if (!id) {
        return false;
    }
    const annoItem = config[id];
    if (!annoItem) {
        return false;
    }
    const pageItem = annoItem.pages.find((item) => item.index === pageIndex);
    if (!pageItem) {
        return false;
    }
    pageItem.positions = [position];
    annoItem.mode = "rect";
    target.dataset.mode = "rect";
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
    return true;
};

export const initDragResizeHandler = (element: HTMLElement, pdf: IPdfInstance) => {
    let ignoreRectClick = false;
    const firstElementChild = element.firstElementChild;
    if (!(firstElementChild instanceof HTMLElement)) {
        return;
    }
    const setIgnoreRectClick = (value: boolean) => {
        ignoreRectClick = value;
    };
    firstElementChild.addEventListener("mousedown", (event: MouseEvent) => {
        handleMousedown(event, element, pdf, () => ignoreRectClick, setIgnoreRectClick);
    }, { capture: true });
    firstElementChild.addEventListener("click", (event: MouseEvent) => {
        handleClick(event, () => ignoreRectClick, setIgnoreRectClick);
    }, { capture: true });
};

const isResizeDirection = (value: string | undefined): value is RectResizeDirection => {
    return value === "nw" || value === "ne" || value === "sw" || value === "se";
};

const handleMousedown = (
    event: MouseEvent,
    element: HTMLElement,
    pdf: IPdfInstance,
    getIgnore: () => boolean,
    setIgnore: (value: boolean) => void,
) => {
    if (event.button !== 0) {
        return;
    }
    const rectAnnoElement = pdf.appConfig.toolbar.rectAnno;
    if (rectAnnoElement instanceof HTMLElement && rectAnnoElement.classList.contains("toggled")) {
        return;
    }
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    const handleRaw = event.target.closest(".pdf__rect-resize");
    const targetRaw = event.target.closest(".pdf__rect");
    if (!(targetRaw instanceof HTMLElement)) {
        return;
    }
    const handleElement = handleRaw instanceof HTMLElement ? handleRaw : null;
    const isHandle = handleElement !== null;
    if (!isHandle && !isRectAnnotationElement(targetRaw)) {
        return;
    }
    const rawDirection = handleElement?.dataset.direction;
    const direction = isResizeDirection(rawDirection) ? rawDirection : undefined;
    if (isHandle && !direction) {
        return;
    }
    const pageInfo = getPageViewInfo(targetRaw, pdf);
    if (!pageInfo) {
        return;
    }
    const annotationElement = targetRaw.firstElementChild;
    if (!(annotationElement instanceof HTMLElement)) {
        return;
    }
    const { page, pageIndex } = pageInfo;
    const { initial, boundary } = createBounds(annotationElement, page);
    const canvasRect = page.canvas.getBoundingClientRect();
    startDragSession({
        event,
        element,
        target: targetRaw,
        handleElement,
        direction,
        initial,
        boundary,
        page,
        pageIndex,
        annotationElement,
        canvasRect,
        getIgnore,
        setIgnore,
        persistPosition,
        pdf,
    });
    event.preventDefault();
    event.stopPropagation();
};

type DragCtx = {
    event: MouseEvent;
    element: HTMLElement;
    target: HTMLElement;
    handleElement: HTMLElement | null;
    direction: RectResizeDirection | undefined;
    initial: RectBounds;
    boundary: RectBounds;
    page: IPdfPageView;
    pageIndex: number;
    annotationElement: HTMLElement;
    canvasRect: DOMRect;
    getIgnore: () => boolean;
    setIgnore: (value: boolean) => void;
    persistPosition: typeof persistPosition;
    pdf: IPdfInstance;
};

type DragState = {
    bounds: RectBounds;
    moved: boolean;
    position: number[];
    startX: number;
    startY: number;
};

const syncPosition = (state: DragState, ctx: DragCtx) => {
    const leftTop = ctx.page.viewport.convertToPdfPoint(
        state.bounds.left - ctx.canvasRect.left,
        state.bounds.top - ctx.canvasRect.top,
    );
    const rightBottom = ctx.page.viewport.convertToPdfPoint(
        state.bounds.right - ctx.canvasRect.left,
        state.bounds.bottom - ctx.canvasRect.top,
    );
    state.position = leftTop.concat(rightBottom);
    setRectPosition(ctx.annotationElement, ctx.page, state.position);
};

const startDragSession = (ctx: DragCtx) => {
    const state: DragState = {
        bounds: ctx.initial,
        moved: false,
        position: [],
        startX: ctx.event.clientX,
        startY: ctx.event.clientY,
    };
    const mousemove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - state.startX;
        const deltaY = moveEvent.clientY - state.startY;
        if (!state.moved && Math.hypot(deltaX, deltaY) < Constants.SIZE_DRAG_THRESHOLD) {
            return;
        }
        if (!state.moved) {
            state.moved = true;
            if (!ctx.target.classList.contains("pdf__rect--selected")) {
                showToolbar(ctx.element, undefined, ctx.target);
            }
            hideToolbarMenu(ctx.element);
            ctx.target.classList.add("pdf__rect--dragging");
        }
        const resizeDirection = ctx.handleElement ? ctx.direction : undefined;
        if (isResizeDirection(resizeDirection)) {
            state.bounds = resizeRectBounds(
                ctx.initial,
                ctx.boundary,
                resizeDirection,
                moveEvent.clientX,
                moveEvent.clientY,
                RECT_RESIZE_MIN_SIZE,
            );
        }
        if (!isResizeDirection(resizeDirection)) {
            state.bounds = moveRectBounds(ctx.initial, ctx.boundary, deltaX, deltaY);
        }
        syncPosition(state, ctx);
    };
    const mouseup = () => {
        document.removeEventListener("mousemove", mousemove);
        document.removeEventListener("mouseup", mouseup);
        ctx.target.classList.remove("pdf__rect--dragging");
        if (!state.moved) {
            return;
        }
        ctx.setIgnore(true);
        setTimeout(() => ctx.setIgnore(false));
        const persisted = ctx.persistPosition(ctx.pdf, ctx.target, ctx.pageIndex, state.position);
        if (!persisted) {
            state.bounds = ctx.initial;
            syncPosition(state, ctx);
        }
        hideToolbarMenu(ctx.element);
    };
    document.addEventListener("mousemove", mousemove);
    document.addEventListener("mouseup", mouseup);
};

const handleClick = (
    event: MouseEvent,
    getIgnore: () => boolean,
    setIgnore: (value: boolean) => void,
) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    if (getIgnore()) {
        setIgnore(false);
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    if (event.target.closest(".pdf__rect-resize")) {
        event.preventDefault();
        event.stopPropagation();
    }
};

export const __test__ = {
    setRectPosition,
    isRectAnnotationElement,
    hideToolbarMenu,
};
