/**
 * @fileoverview 初始化搜索编辑器
 */

import { Constants } from "../../../constants";
import { Protyle } from "../../../protyle";
import type { App } from "../../..";

import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { IEditorInitResult, ILayoutData } from "./initSearchEditors.types";


/**
 * 初始化搜索预览编辑器
 * 
 * @param app - 应用实例
 * @param element - 根容器元素
 * @param closeCB - 是否存在关闭回调
 * @returns 编辑器实例
 */
export function initSearchEditors(
    app: App,
    element: HTMLElement,
    closeCB: boolean
): IEditorInitResult<Protyle> {
    const data: ILayoutData = getSiyuanStorage()[Constants.LOCAL_SEARCHKEYS];

    // 创建主搜索预览编辑器
    const searchPreviewElement = element.querySelector("#searchPreview");
    if (!(searchPreviewElement instanceof HTMLElement)) {
        throw new Error("#searchPreview not found");
    }

    // 创建主搜索预览编辑器
    const edit = new Protyle(app, searchPreviewElement, {
        blockId: "",
        render: {
            background: true,
            gutter: true,
            breadcrumbDocName: true,
            title: true
        },
    });
    edit.resize();

    const searchUnRefPreviewElement = element.querySelector("#searchUnRefPreview");
    if (!(searchUnRefPreviewElement instanceof HTMLElement)) {
        throw new Error("#searchUnRefPreview not found");
    }

    // 创建无效引用预览编辑器
    const unRefEdit = new Protyle(app, searchUnRefPreviewElement, {
        blockId: "",
        render: {
            gutter: true,
            breadcrumbDocName: true,
            title: true
        },
    });
    unRefEdit.resize();

    // 根据布局设置编辑器尺寸
    applyEditorLayout(edit, data, closeCB);

    return { edit, unRefEdit };
}

/**
 * 应用编辑器布局设置
 */
function applyEditorLayout(edit: Protyle, data: ILayoutData, closeCB: boolean): void {
    if (closeCB) {
        applyPopupLayout(edit, data);
        return;
    }
    applyTabLayout(edit, data);
}

/**
 * 应用弹窗模式布局
 */
function applyPopupLayout(edit: Protyle, data: ILayoutData) {
    if (data.layout === 1 && data.col) {
        edit.protyle.element.style.width = data.col;
        edit.protyle.element.classList.remove("fn__flex-1");
        return;
    }
    if (data.layout !== 1 && data.row) {
        edit.protyle.element.classList.remove("fn__flex-1");
        edit.protyle.element.style.height = data.row;
    }
}

/**
 * 应用页签模式布局
 */
function applyTabLayout(edit: Protyle, data: ILayoutData) {
    if (data.layoutTab === 1 && data.colTab) {
        edit.protyle.element.style.width = data.colTab;
        edit.protyle.element.classList.remove("fn__flex-1");
        return;
    }
    if (data.layoutTab !== 1 && data.rowTab) {
        edit.protyle.element.classList.remove("fn__flex-1");
        edit.protyle.element.style.height = data.rowTab;
    }
}

