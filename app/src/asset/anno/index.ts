import type { RectElementType, IPdfInstance } from "./anno.types";
import { getConfig } from "./config";
import { initRectAnnoTool } from "./anno.initRectAnnoTool";
import { initResizeHandler } from "./anno.resize";
import { handlePdfClick, processSelection } from "./click";
import { showToolbar } from "./anno.showToolbar";
import { isHTMLElement } from "../../util/DOM/element.guard";


/**
 * 全局变量，存储当前选中的矩形注释元素
 * 用于跟踪和管理当前正在操作的注释元素
 */
export let rectElement: RectElementType;

/**
 * 清空当前选中的矩形注释元素
 * @AITODO 仅有一行的函数没有存在意义
 * @作用 重置全局状态，取消对任何矩形注释的当前聚焦
 * @意图 在注释操作完成或用户取消交互时清理状态，防止逻辑误操作
 * @调用时机 1. 点击背景取消选中时 2. 完成一次注释编辑后
 */
export const clearRectElement = () => {
    /** @同步豁免: 极简状态重置，不涉及异步逻辑 */
    rectElement = null;
};

/**
 * 设置当前选中的矩形注释元素
 * 
 * @作用 更新全局状态，标记当前正在操作的矩形注释元素
 * @意图 集中管理交互目标，方便在不同的交互处理器间共享选中的元素
 * @调用时机 1. 用户点击某个注释矩形时 2. 刚创建一个新的矩形注释时
 * 
 * @param element - 要设为当前选中的矩形注释元素
 */
export const setRectElement = (element: RectElementType) => {
    /** @同步豁免: 极简状态赋值，不涉及异步逻辑 */
    rectElement = element;
};


/**
 * 处理PDF容器的点击事件
 * 
 * @作用 将点击事件分发给具体的PDF交互逻辑处理器
 * @意图 作为事件处理入口，确保所有的PDF交互操作都能被正确分发和执行
 * @调用时机 当用户点击PDF容器时通过事件监听器触发
 */
export const handleContainerClick = async (event: MouseEvent, element: HTMLElement, pdf: IPdfInstance) => {
    await handlePdfClick(event, element, pdf);
};

/**
 * 处理PDF容器的右键菜单事件
 * 
 * @作用 阻止浏览器默认菜单，并根据上下文显示自定义的PDF工具栏（主要用于导出页面）
 * @意图 提供在无需选区或点击注释的情况下访问PDF导出功能
 * @调用时机 当用户右键点击PDF页面区域时触发
 * 
 * @param event - 鼠标右键事件
 * @param element - PDF容器元素
 */
export const handleContainerContextMenu = (event: MouseEvent, element: HTMLElement) => {
    /** @同步豁免: 需要阻止默认行为并立即打开UI组件 */
    const target = event.target;
    if (isHTMLElement(target) && target.closest(".pdf__rect")) {
        return;
    }
    event.preventDefault();
    showToolbar(element, undefined, undefined, "contextmenu");
    const utilElement = element.querySelector(".pdf__util");
    /** 
     * 处理右键点击后的工具栏定位
     * 生效场景：工具栏已挂载到DOM中，需要根据鼠标点击坐标移动其位置
     */
    if (isHTMLElement(utilElement)) {
        /** @内联回调 */
        import("../../util/DOM/setPosition").then(({ setPosition }) => {
            setPosition(utilElement, event.clientX, event.clientY);
        });
    }
};

/**
 * 处理PDF容器的鼠标抬起事件
 * 
 * @作用 用于文本选区结束后的交互处理，如显示注释工具栏
 * @意图 通过 mouseup 捕获稳定的文本选区状态
 * @调用时机 当用户在PDF容器中松开鼠标键时触发
 * 
 * @param element - PDF容器元素
 */
export const handleContainerMouseUp = (element: HTMLElement) => {
    /** @同步豁免: 简单逻辑转发，无耗时操作 */
    processSelection(element);
};

/**
 * 初始化PDF注释功能
 * 负责设置PDF文档的注释系统，包括工具初始化和事件处理
 * 
 * @作用 负责设置PDF文档的注释系统，配置工具栏、调整缩放处理以及注册各类交互事件监听器
 * @意图 为PDF查看器注入富交互功能，包括矩形标注、文本高亮和页面导出等
 * @调用时机 在PDF资源加载并挂载到DOM后，由 Asset 模型进行初始化
 * 
 * @param element PDF查看器的DOM容器元素
 * @param pdf PDF实例对象，包含PDF文档和查看器的相关信息
 * @returns 返回传入的PDF实例，便于链式调用
 */
export const initAnno = (element: HTMLElement, pdf: IPdfInstance) => {
    /** @同步豁免: UI初始化逻辑，必须在渲染流程中同步完成 */
    getConfig(pdf);
    initRectAnnoTool(element, pdf);
    initResizeHandler(pdf);

    // @内联回调
    element.addEventListener("click", (event: MouseEvent) => {
        handleContainerClick(event, element, pdf);
    });
    // @内联回调
    element.addEventListener("contextmenu", (event: MouseEvent) => {
        handleContainerContextMenu(event, element);
    });
    // @内联回调
    element.addEventListener("mouseup", () => {
        handleContainerMouseUp(element);
    });
    return pdf;
};

/**
 * 获取指定元素中的第一个或最后一个有效文本节点
 * 用于在PDF文本层中定位文本内容的边界，支持注释定位功能
 * 
 * @作用 在给定的HTML容器内，按照指定的方向搜索第一个或最后一个具有非空文本内容的 span 元素
 * @意图 用于精准定位PDF文本层中的选中内容边界，为注释定位提供DOM支持
 * @调用时机 在计算高亮矩形坐标或执行文本关联逻辑时被内部调研
 * 
 * @param element 要搜索的父元素，通常是PDF页面的文本层
 * @param isFirst 是否获取第一个文本节点，false表示获取最后一个
 * @returns 返回找到的包含文本内容的span元素，如果没有找到则返回undefined
 */
export const getTextNode = (element: HTMLElement, isFirst: boolean) => {
    /** @同步豁免: DOM 遍历操作，属于底层定位工具函数，通常同步执行 */
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (spans[index]) {
        const target = spans[index];
        if (target?.textContent) {
            break;
        }

        if (isFirst) {
            index++;
            continue;
        }
        index--;
    }
    return spans[index];
};
