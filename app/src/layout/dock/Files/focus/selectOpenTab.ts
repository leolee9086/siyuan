/** 用途：查找文件 Dock；使用范围：定位当前编辑器文档；解耦评估：经本域网关直达无状态查询。 */
import {getDockByType} from "./imports";
/** 用途：查找活动页签实例；使用范围：定位当前编辑器文档；解耦评估：经本域网关直达布局查询。 */
import {getInstanceById} from "./imports";
/** 用途：判别 Editor 完整领域；使用范围：活动页签模型；解耦评估：经本域网关直达厂牌守卫。 */
import {isEditorDomain} from "./imports";
/** 用途：判别 Files 完整领域；使用范围：Dock 文件模型；解耦评估：经子域网关直达父领域唯一厂牌守卫。 */
import {isFilesDomain} from "./imports";
/** 用途：描述完整 Files 领域；使用范围：活动编辑器定位行为；解耦评估：经子域网关直达完整抽象。 */
import type {FilesDomain} from "./imports";
/** 用途：判别 LayoutTab 完整领域；使用范围：布局查询结果；解耦评估：经本域网关直达布局守卫。 */
import {isLayoutTab} from "./imports";

/** 将活动 Editor 页签的文档定位到给定完整文件树领域。 */
const focusActiveEditorInFileTree = async (fileModel: FilesDomain) => {
    const focusedTabElement = document.querySelector(".layout__wnd--active > .fn__flex > .layout-tab-bar > .item--focus") ??
        document.querySelector("ul.layout-tab-bar > .item--focus");
    const tabId = focusedTabElement?.getAttribute("data-id");
    const tab = tabId ? getInstanceById(tabId) : undefined;
    if (!tab || !isLayoutTab(tab) || !isEditorDomain(tab.model)) {
        return;
    }
    const protyle = tab.model.editor.protyle;
    if (!protyle.wysiwyg || !protyle.title || !protyle.notebookId || !protyle.path) {
        throw new Error("Active editor is missing initialized Protyle surfaces");
    }
    protyle.wysiwyg.element.blur();
    protyle.title.editElement.blur();
    await fileModel.selectItem(protyle.notebookId, protyle.path);
    fileModel.lastSelectedElement = fileModel.element.querySelector(".b3-list-item--focus");
};

/** 将当前活动编辑器对应文档定位到文件树，并展开文件 Dock。 */
export const selectOpenTab = async () => {
    const fileDock = getDockByType("file");
    const fileModel = fileDock?.data.file;
    if (!fileDock || !fileModel || typeof fileModel !== "object" || !isFilesDomain(fileModel)) {
        return false;
    }
    await focusActiveEditorInFileTree(fileModel);
    fileDock.toggleModel("file", true);
};
