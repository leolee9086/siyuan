/**
 * @fileoverview 初始化搜索编辑器
 */

/** 用途：读取搜索布局存储键；使用范围：预览编辑器初始化；解耦评估：稳定静态值，无需经运行时注入。 */
import {Constants} from "./imports";
/** 用途：完整应用外观；使用范围：创建两个预览 Protyle；解耦评估：类型依赖完整领域根，不加载具体 App。 */
import type {AppFacade} from "./imports";
/** 用途：完整 Protyle 领域根；使用范围：编辑器布局设置；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "./imports";

/** 用途：读取已初始化的搜索布局状态；使用范围：编辑器尺寸恢复；解耦评估：严格环境访问器在缺失时显式失败。 */
import {getSiyuanStorage} from "./imports";
/** 用途：搜索布局持久化数据；使用范围：弹窗与 Tab 尺寸恢复；解耦评估：本子域纯数据类型。 */
import type {ILayoutData} from "./initSearchEditors.types";


/**
 * 初始化搜索预览编辑器
 * 
 * @param app - 应用实例
 * @param element - 根容器元素
 * @param closeCB - 是否存在关闭回调
 * @returns 编辑器实例
 * @同步豁免: UI构建 - genSearch 必须在当前调用栈取得编辑器并立即绑定交互与启动首轮搜索。
 */
export function initSearchEditors(
    app: AppFacade,
    element: HTMLElement,
    closeCB: boolean
) {
    const data: ILayoutData = getSiyuanStorage()[Constants.LOCAL_SEARCHKEYS];

    // 创建主搜索预览编辑器
    const searchPreviewElement = element.querySelector("#searchPreview");
    if (!(searchPreviewElement instanceof HTMLElement)) {
        throw new Error("#searchPreview not found");
    }

    // 创建主搜索预览编辑器
    const edit = app.createProtyle(searchPreviewElement, {
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
    const unRefEdit = app.createProtyle(searchUnRefPreviewElement, {
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
function applyEditorLayout(edit: ProtyleDomain, data: ILayoutData, closeCB: boolean) {
    if (closeCB) {
        applyPopupLayout(edit, data);
        return;
    }
    applyTabLayout(edit, data);
}

/**
 * 应用弹窗模式布局
 */
function applyPopupLayout(edit: ProtyleDomain, data: ILayoutData) {
    // 左右布局恢复弹窗上次保存的列宽，并退出弹性填充。
    if (data.layout === 1 && data.col) {
        edit.protyle.element.style.width = data.col;
        edit.protyle.element.classList.remove("fn__flex-1");
        return;
    }
    // 上下布局恢复弹窗上次保存的行高，并退出弹性填充。
    if (data.layout !== 1 && data.row) {
        edit.protyle.element.classList.remove("fn__flex-1");
        edit.protyle.element.style.height = data.row;
    }
}

/**
 * 应用页签模式布局
 */
function applyTabLayout(edit: ProtyleDomain, data: ILayoutData) {
    // 左右布局恢复页签上次保存的列宽，并退出弹性填充。
    if (data.layoutTab === 1 && data.colTab) {
        edit.protyle.element.style.width = data.colTab;
        edit.protyle.element.classList.remove("fn__flex-1");
        return;
    }
    // 上下布局恢复页签上次保存的行高，并退出弹性填充。
    if (data.layoutTab !== 1 && data.rowTab) {
        edit.protyle.element.classList.remove("fn__flex-1");
        edit.protyle.element.style.height = data.rowTab;
    }
}

