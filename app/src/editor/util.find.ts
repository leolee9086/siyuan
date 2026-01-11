import { getAllModels } from "../layout/getAll";
import { pdfIsLoading } from "../layout/util";
import { clearOBG } from "../layout/dock/util";
import { objEquals } from "../util/functions";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getUnInitTab } from "./util.getUnInitTab";
import { switchEditor } from "./util.switchEditor";
import { Editor } from "./index";

/**  处理找到的编辑器 */
const handleFoundEditor = (editor: Editor, options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    if (!pdfIsLoading(editor.parent.parent.element)) {
        switchEditor(editor, options, allModels);
    }
    options.afterOpen?.(editor);
    return editor.parent;
};

/**  查找并打开资源文件 */
export const findAndOpenAsset = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    if (!options.assetPath) {
        return;
    }
    clearOBG();
    for (const item of allModels.asset) {
        if (item.path !== options.assetPath) {
            continue;
        }
        const isLoading = pdfIsLoading(item.parent.parent.element);
        if (!isLoading) {
            item.parent.parent.switchTab(item.parent.headElement);
            item.parent.parent.showHeading();
        }
        if (!isLoading && typeof options.page === "number") {
            item.goToPage(options.page);
        }
        options.afterOpen?.(item);
        return item.parent;
    }
};

/**  查找并打开自定义页签 */
export const findAndOpenCustom = (options: IOpenFileOptions, allModels: ReturnType<typeof getAllModels>) => {
    if (!options.custom) {
        return;
    }
    clearOBG();
    for (const item of allModels.custom) {
        if (!objEquals(item.data, options.custom.data) || (options.custom.id && options.custom.id !== item.type)) {
            continue;
        }
        if (!pdfIsLoading(item.parent.parent.element)) {
            item.parent.parent.switchTab(item.parent.headElement);
            item.parent.parent.showHeading();
        }
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
    if (!options.searchData) {
        return;
    }
    clearOBG();
    for (const item of allModels.search) {
        if (!objEquals(item.config, options.searchData)) {
            continue;
        }
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
        if (hasClosestByClassName(item.element, "layout__wnd--active")) {
            activeEditor = item;
        }
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
