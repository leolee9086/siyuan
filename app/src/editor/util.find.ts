/** 用途：获取所有模型实例。使用范围：遍历页签查找匹配项。解耦评估：通过 ./imports 转发。 */
import { getAllModels } from "./imports";
/** 用途：PDF 加载状态判断。使用范围：切换 PDF 页签前等待加载完成。解耦评估：通过 ./imports 转发。 */
import { pdfIsLoading } from "./imports";
/** 用途：清除对象块图标。使用范围：打开文件时清理 OBG 显示。解耦评估：通过 ./imports 转发。 */
import {clearObjectBlockGraphs} from "./imports";
/** 用途：对象比较工具。使用范围：比较自定义页签配置。解耦评估：通过 ./imports 转发。 */
import { objEquals } from "./imports";
/** 用途：通过类名查找祖先元素。使用范围：判断编辑器所在窗口是否激活。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：获取未初始化的页签。使用范围：找不到打开的编辑器时尝试初始化。解耦评估：同目录模块直接导入。 */
import { getUnInitTab, isSameCustomTab } from "./util.getUnInitTab";
/** 用途：切换到指定编辑器。使用范围：查找到编辑器后切换焦点。解耦评估：同目录模块直接导入。 */
import { switchEditor } from "./util.switchEditor";
/** 用途：编辑器类型。使用范围：查找编辑器函数的返回值类型。解耦评估：同目录模块直接导入。 */
import { Editor } from "./index";

/**  处理找到的编辑器 */
const handleFoundEditor = (editor: Editor, options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    // 仅在 PDF 未加载时切换编辑器焦点
    if (!pdfIsLoading(editor.parent.parent.element)) {
        switchEditor(editor, options, allModels);
    }
    options.afterOpen?.(editor);
    return editor.parent;
};

/**  查找并打开资源文件 */
export const findAndOpenAsset = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    // 卫语句：无资源路径时直接返回
    if (!options.assetPath) {
        return;
    }
    clearObjectBlockGraphs(allModels);
    for (const item of allModels.asset) {
        if (item.path !== options.assetPath) {
            continue;
        }
        const isLoading = pdfIsLoading(item.parent.parent.element);
        if (!isLoading) {
            item.parent.parent.switchTab(item.parent.headElement);
            item.parent.parent.showHeading();
        }
        // 加载完成后跳转到指定页码
        if (!isLoading && typeof options.page === "number") {
            item.goToPage(options.page);
        }
        options.afterOpen?.(item);
        return item.parent;
    }
};

/**  查找并打开自定义页签 */
export const findAndOpenCustom = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    // 卫语句：无自定义数据时直接返回
    if (!options.custom) {
        return;
    }
    clearObjectBlockGraphs(allModels);
    if (options.openNewTab) {
        return;
    }
    for (const item of allModels.custom) {
        if (!isSameCustomTab(item.type, item.data, options)) {
            continue;
        }
        // 仅在 PDF 未加载时切换页签
        // 仅在 PDF 未加载时切换页签
        if (!pdfIsLoading(item.parent.parent.element)) {
            item.parent.parent.switchTab(item.parent.headElement);
            item.parent.parent.showHeading();
        }
        // 执行自定义回调
        if (options.afterOpen) {
            options.afterOpen(item);
        }
        return item.parent;
    }
    const hasModel = getUnInitTab(options);
    if (hasModel) {
        options.afterOpen?.(hasModel.model);
        return hasModel;
    }
};

/**  查找并打开搜索页签 */
export const findAndOpenSearch = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    // 卫语句：无搜索数据时直接返回
    if (!options.searchData) {
        return;
    }
    clearObjectBlockGraphs(allModels);
    for (const item of allModels.search) {
        if (!objEquals(item.config, options.searchData)) {
            continue;
        }
        // 仅在 PDF 未加载时切换页签
        // 仅在 PDF 未加载时切换页签
        if (!pdfIsLoading(item.parent.parent.element)) {
            item.parent.parent.switchTab(item.parent.headElement);
            item.parent.parent.showHeading();
        }
        return item.parent;
    }
};

/**  查找并打开编辑器 */
export const findAndOpenEditor = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    if (options.position || options.openNewTab) {
        return;
    }
    let editor: Editor | undefined;
    let activeEditor: Editor | undefined;
    for (const item of allModels.editor) {
        if (item.editor.protyle.block.rootID !== options.rootID) {
            continue;
        }
        // 检查编辑器所在窗口是否为激活状态
        if (hasClosestByClassName(item.element, "layout__wnd--active")) {
            activeEditor = item;
        }
        // 选择激活时间最新的编辑器实例
        if (!editor || (item.headElement.getAttribute("data-activetime") || "") > (editor.headElement.getAttribute("data-activetime") || "")) {
            // https://github.com/siyuan-note/siyuan/issues/11981#issuecomment-2351939812
            editor = item;
        }
        if (activeEditor) {
            break;
        }
    }
    if (activeEditor) {
        editor = activeEditor;
    }

    if (editor) {
        return handleFoundEditor(editor, options, allModels);
    }

    // 没有初始化的页签无法检测到
    const hasEditor = getUnInitTab(options);
    if (hasEditor) {
        options.afterOpen?.(hasEditor.model);
        return hasEditor;
    }
};





