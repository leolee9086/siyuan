/**
 * 模板选择功能
 * 从 Toolbar 类中拆分出来以减少文件大小
 */
import { getSelectionPosition } from "../util/selection";
import { hideElements } from "../ui/hideElements";
import { isMobile } from "../../platform";
import { setPosition } from "../../util/DOM/positioning/setPosition";
import { fetchPost } from "../../util/network/fetch";
import { previewTemplate } from "./util";
import { resizeSide } from "../../history/resizeSide";
import { getSiyuanMenus, incrementSiyuanZIndex } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getWindowInnerHeight } from "../../util/siyuanEnvironments/getWindowInnerHeight.environment";
import { 生成模板列表项HTML, 生成面板HTML } from "./showTpl/showTpl.template";
import {
    创建悬停事件处理器,
    创建键盘事件处理器,
    设置输入事件,
    设置点击事件
} from "./showTpl/showTpl.handlers";
import type { ITemplateState, IHandlerContext } from "./showTpl/showTpl.types";

const LINE_HEIGHT = 32;

/**
 * 显示模板选择面板
 */
export function 显示模板选择(
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    setRange: (range: Range) => void
): void {
    setRange(range);
    hideElements(["hint"], protyle);
    getSiyuanMenus()?.menu.remove();
    subElement.style.width = "";
    subElement.style.padding = "";
    subElement.innerHTML = 生成面板HTML();

    const elements = 获取必需元素(subElement);
    if (!elements) {
        return;
    }
    const { listElement, previewElement, inputElement } = elements;

    配置面板调整(subElement, listElement);

    const state: ITemplateState = { previewPath: "" };
    const handlerContext: IHandlerContext = { state, previewElement, protyle, subElement, listElement, inputElement, nodeElement, range };

    listElement.addEventListener("mouseover", 创建悬停事件处理器(handlerContext));
    inputElement.addEventListener("keydown", 创建键盘事件处理器(handlerContext));
    设置输入事件(inputElement, listElement, previewElement, state, protyle);
    设置点击事件(subElement, inputElement, listElement, previewElement, state, protyle, nodeElement, range);

    显示面板并加载数据(subElement, toolbarElement, inputElement, listElement, previewElement, state, protyle, nodeElement, range);
}


function 获取必需元素(subElement: HTMLElement): Pick<IHandlerContext, "listElement" | "previewElement" | "inputElement"> | null {
    const listElement = subElement.querySelector(".b3-list");
    if (!listElement) {
        return null;
    }
    const previewElement = subElement.firstElementChild?.lastElementChild;
    if (!previewElement) {
        return null;
    }
    const inputElement = subElement.querySelector("input");
    if (!inputElement) {
        return null;
    }
    return { listElement, previewElement, inputElement };
}

function 配置面板调整(subElement: HTMLElement, listElement: Element): void {
    const resizeElement = subElement.querySelector(".toolbarResize");
    if (resizeElement instanceof HTMLElement && listElement.parentElement) {
        resizeSide(resizeElement, listElement.parentElement);
    }
}

function 显示面板并加载数据(
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    inputElement: HTMLInputElement,
    listElement: Element,
    previewElement: Element,
    state: ITemplateState,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range
): void {
    subElement.style.zIndex = incrementSiyuanZIndex().toString();
    subElement.classList.remove("fn__none");
    toolbarElement.classList.add("fn__none");
    inputElement.select();

    const parentID = protyle.block.parentID;
    fetchPost("/api/search/searchTemplate", { k: "" }, (response) =>
        处理模板搜索结果(response, subElement, nodeElement, range, state, listElement, previewElement, parentID)
    );
}

function 设置面板位置(subElement: HTMLElement, nodeElement: HTMLElement, range: Range): void {
    if (!isMobile) {
        const rangePosition = getSelectionPosition(nodeElement, range);
        setPosition(subElement, rangePosition.left, rangePosition.top + 18, LINE_HEIGHT);
        const firstChild = subElement.firstElementChild;
        if (firstChild instanceof HTMLElement) {
            const windowHeight = getWindowInnerHeight();
            firstChild.style.maxHeight = Math.min(windowHeight * 0.8, windowHeight - subElement.getBoundingClientRect().top) - 16 + "px";
        }
    }
    if (isMobile) {
        setPosition(subElement, 0, 0);
    }
}

function 处理模板搜索结果(
    response: IWebSocketData,
    subElement: HTMLElement,
    nodeElement: HTMLElement,
    range: Range,
    state: ITemplateState,
    listElement: Element,
    previewElement: Element,
    parentID: string | undefined
): void {
    const bgElement = subElement.querySelector(".b3-list--background");
    if (bgElement && response.data?.templates) {
        bgElement.innerHTML = 生成模板列表项HTML(response.data.templates);
    }
    设置面板位置(subElement, nodeElement, range);
    state.previewPath = listElement.firstElementChild?.getAttribute("data-value") ?? "";
    previewTemplate(state.previewPath, previewElement, parentID ?? "");
}
