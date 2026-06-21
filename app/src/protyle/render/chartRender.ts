import { addScript } from "../util/addScript";
import { Constants } from "../../constants";
import { hasClosestByClassName } from "../util/hasClosest";
import { genIconHTML } from "./util";
import { getEchartsInstanceById, initEcharts, disposeEcharts } from "../../util/siyuanEnvironments/echarts.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isHTMLDivElement } from "../../util/DOM/element.guard";
import { isSeriesArray, isRecord } from "../../util/lib/code/object.guard";
import { parseRenderOption } from "./parseRenderOption";

/** 计算编辑器宽度 */
const calcEditorWidth = (
    wysiswgElement: HTMLElement | false,
    firstEchartsElement: Element
): number | undefined => {
    if (!wysiswgElement) {
        return undefined;
    }
    if (wysiswgElement.clientWidth <= 0) {
        return undefined;
    }
    const firstElementChild = firstEchartsElement.firstElementChild;
    if (!firstElementChild || firstElementChild.clientWidth !== 0) {
        return undefined;
    }
    const wysiswgFirstChild = wysiswgElement.firstElementChild;
    if (!wysiswgFirstChild) {
        return undefined;
    }
    return wysiswgFirstChild.clientWidth;
};

/** 准备渲染容器 */
const prepareRenderContainer = (
    renderElement: HTMLElement,
    hasContent: boolean,
    defaultHeight: string
) => {
    if (!hasContent) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span>`;
        return;
    }
    if (!renderElement.lastElementChild || renderElement.childElementCount === 1) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div style="height:${defaultHeight}" contenteditable="false"></div>`;
        return;
    }
    renderElement.lastElementChild.classList.remove("ft__error");
};

/** 判断图表类型是否变更 */
const isChartTypeChanged = (
    currentSeries: Array<{ type?: string }>,
    newSeries: unknown[] | undefined
): boolean => {
    const currentFirst = currentSeries[0];
    const newFirst = isSeriesArray(newSeries) ? newSeries[0] : undefined;
    return currentFirst?.type !== newFirst?.type;
};

/** 更新已有图表实例 */
const updateExistingChart = (
    chartInstance: ReturnType<typeof getEchartsInstanceById>,
    option: unknown
) => {
    if (!chartInstance) {
        return;
    }
    const currentSeries = chartInstance.getOption().series;
    const rawSeries = isRecord(option) ? option.series : undefined;
    const optionSeries = Array.isArray(rawSeries) ? rawSeries : undefined;
    if (isChartTypeChanged(currentSeries, optionSeries)) {
        chartInstance.clear();
    }
    chartInstance.resize();
};

/** 初始化新图表 */
const initNewChart = (
    lastChild: Element | null,
    option: unknown,
    width: number | undefined
) => {
    if (!(lastChild instanceof HTMLElement)) {
        return;
    }
    const config = getSiyuanConfig();
    const theme = config.appearance.mode === 1 ? "dark" : undefined;
    const initOpts = width !== undefined ? { width } : undefined;
    initEcharts(lastChild, theme, initOpts)?.setOption(option);
};

/** 渲染图表错误信息 */
const renderChartError = (
    renderElement: HTMLElement,
    defaultHeight: string,
    error: unknown
) => {
    disposeEcharts(renderElement.lastElementChild);
    renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div class="ft__error" style="height:${defaultHeight}" contenteditable="false">echarts render error: <br>${error}</div>`;
};

/** 渲染单个 echarts 图表元素 */
const renderSingleChart = async (
    e: HTMLDivElement,
    wysiswgElement: HTMLElement | false,
    width: number | undefined
) => {
    if (e.getAttribute("data-render") === "true") {
        return;
    }
    const firstChild = e.firstElementChild;
    if (!firstChild) {
        return;
    }
    if (!firstChild.classList.contains("protyle-icons")) {
        e.insertAdjacentHTML("afterbegin", genIconHTML(wysiswgElement, ["refresh", "edit", "more"]));
    }
    const renderElement = e.firstElementChild?.nextElementSibling;
    if (!(renderElement instanceof HTMLElement)) {
        return;
    }
    // 需置于异步渲染前，否则快速滚动会导致重复渲染
    e.setAttribute("data-render", "true");
    const dataContent = e.getAttribute("data-content");
    const defaultHeight = e.style.height || "420px";

    prepareRenderContainer(renderElement, !!dataContent, defaultHeight);
    if (!dataContent) {
        return;
    }

    try {
        const lastChild = renderElement.lastElementChild;
        const instanceId = lastChild?.getAttribute("_echarts_instance_") ?? null;
        const chartInstance = getEchartsInstanceById(instanceId);
        const option = parseRenderOption(Lute.UnEscapeHTMLStr(dataContent));
        updateExistingChart(chartInstance, option);
        initNewChart(lastChild, option, width);
    } catch (error) {
        renderChartError(renderElement, defaultHeight, error);
    }
};

/** 执行图表渲染循环 */
const renderEchartsLoop = (
    echartsElements: Element[],
    wysiswgElement: HTMLElement | false,
    width: number | undefined
) => {
    for (const e of echartsElements) {
        if (isHTMLDivElement(e)) {
            renderSingleChart(e, wysiswgElement, width);
        }
    }
};

/** 加载 echarts GL 脚本后的回调 */
const onEchartsGLLoaded = (
    element: Element,
    echartsElements: Element[]
) => {
    const wysiswgElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
    const firstEchartsElement = echartsElements[0];
    if (!firstEchartsElement) {
        return;
    }
    const width = calcEditorWidth(wysiswgElement, firstEchartsElement);
    renderEchartsLoop(echartsElements, wysiswgElement, width);
};

/** 加载 echarts GL 脚本并渲染 */
const loadEchartsGLAndRender = (
    cdn: string,
    element: Element,
    echartsElements: Element[]
) => {
    addScript(`${cdn}/js/echarts/echarts-gl.min.js?v=2.0.9`, "protyleEchartsGLScript").then(() => {
        onEchartsGLLoaded(element, echartsElements);
    });
};

/** 加载 echarts 脚本 */
const loadEchartsAndRender = (
    cdn: string,
    element: Element,
    echartsElements: Element[]
) => {
    addScript(`${cdn}/js/echarts/echarts.min.js?v=5.3.2`, "protyleEchartsScript").then(() => {
        loadEchartsGLAndRender(cdn, element, echartsElements);
    });
};

export const chartRender = (element: Element, cdn = Constants.PROTYLE_CDN) => {
    const isEchartsBlock = element.getAttribute("data-subtype") === "echarts";
    const echartsElements: Element[] = isEchartsBlock
        ? (element.getAttribute("data-render") === "true" ? [] : [element])
        : Array.from(element.querySelectorAll('[data-subtype="echarts"]:not([data-render="true"])'));

    if (echartsElements.length === 0) {
        return;
    }
    loadEchartsAndRender(cdn, element, echartsElements);
};
