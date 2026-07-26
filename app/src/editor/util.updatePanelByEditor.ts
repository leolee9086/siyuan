/** 用途：文件树模型。使用范围：更新文件树选中状态。解耦评估：通过 ./imports 转发。 */
import {isFilesDomain} from "./imports";
/** 用途：获取所有模型。使用范围：更新面板时遍历模型。解耦评估：通过 ./imports 转发。 */
import { getAllModels } from "./imports";
/** 用途：判断移动端。使用范围：仅在桌面端更新面板。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：统计选中字数和块字数。使用范围：编辑器聚焦时更新统计。解耦评估：通过 ./imports 转发。 */
import { countSelectWord } from "./imports";
/** 用途：统计块字数。使用范围：编辑器聚焦时更新统计。解耦评估：通过 ./imports 转发。 */
import { countBlockWord } from "./imports";
/** 用途：完整 Dock 聚合根。使用范围：从布局调用方传入的文件 Dock 读取模型。 */
import type {DockDomain} from "./imports";
/** 用途：编辑器大小调整。使用范围：面板展开/收起时重绘。解耦评估：通过 ./imports 转发。 */
import { resize } from "./imports";
/** 用途：按选区范围聚焦编辑器。使用范围：还原编辑器焦点。解耦评估：通过 ./imports 转发。 */
import { focusByRange } from "./imports";
/** 用途：聚焦到指定块元素。使用范围：无选区时聚焦第一个块。解耦评估：通过 ./imports 转发。 */
import { focusBlock } from "./imports";
/** 用途：后退栈记录。使用范围：记录编辑器状态到后退栈。解耦评估：通过 ./imports 转发。 */
import { pushBack } from "./imports";
/** 用途：安全获取 SiYuan 配置。使用范围：检查文件树配置项。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：更新反链图。使用范围：切换编辑器时刷新反链面板。解耦评估：同目录模块直接导入。 */
import { updateBacklinkGraph } from "./util.updateBacklinkGraph";
/** 用途：更新大纲面板。使用范围：切换编辑器时刷新大纲。解耦评估：同目录模块直接导入。 */
import { updateOutline } from "./util.updateOutline";

/**
 * 根据编辑器状态更新面板
 *
 * 作用：当编辑器焦点变化、内容加载或操作时，同步更新相关的面板（如大纲、反链、文件树选宠等）。
 * 意图：保持 UI 组件与当前编辑器状态的一致性。
 * 调用时机：switchEditor, focusin, onDrop, switchTab 等。
 *
 * @param options
 * @param options.protyle - 编辑器实例
 * @param options.focus - 是否聚焦到编辑器
 * @param options.pushBackStack - 是否加入后退栈
 * @param options.reload - 是否重新加载
 * @param options.resize - 是否调整大小
 */
export const updatePanelByEditor = async (options: {
    protyle?: IProtyle,
    focus: boolean,
    pushBackStack: boolean,
    reload: boolean,
    resize: boolean
}, fileDock: DockDomain | undefined) => {
    const protyle = options.protyle;
    const isValid = protyle && protyle.path;
    if (isValid && protyle.element.classList.contains("fn__none")) {
        return;
    }

    if (isValid) {
        updateActiveProtyle(protyle, options, fileDock);
    }
    // 切换页签或关闭所有页签时，需更新对应的面板（仅桌面端有大纲和反链面板）
    if (!isMobile) {
        const models = getAllModels();
        updateOutline(models, protyle, options.reload);
        updateBacklinkGraph(models, protyle);
    }
};

/**
 * 更新文件树的选中状态
 *
 * 意图：使文件树高亮当前编辑器对应的文件。
 */
const updateFileTreeSelection = (protyle: IProtyle, fileDock: DockDomain | undefined) => {
    // 意图：如果要定位文件，必须保证 protyle 有路径且包含笔记本 ID。
    const path = protyle.path;
    const notebookId = protyle.notebookId;
    if (!path || !notebookId) {
        return;
    }
    // 意图：检查配置项，只有在开启“始终选择打开的文件”时才自动定位文件树。
    if (!getSiyuanConfig().fileTree.alwaysSelectOpenedFile) {
        return;
    }
    const fileModel = fileDock?.data.file;
    // 意图：确保获取到的 fileModel 是正确的文件树实例。
    if (!fileModel || typeof fileModel !== "object" || !isFilesDomain(fileModel)) {
        return;
    }
    const target = fileModel.element.querySelector(`li[data-path="${path}"]`);
    // 意图：如果当前文件未高亮，则调用 selectItem 进行定位和高亮。
    if (!target || !target.classList.contains("b3-list-item--focus")) {
        fileModel.selectItem(notebookId, path);
    }
};



/**
 * 更新当前活动的编辑器面板
 *
 * 作用：执行特定于当前编辑器的 UI 更新，包括调整大小、聚焦、文件树高亮等。
 * 意图：将 Protyle 实例相关的更新逻辑从主函数中分离，降低 updatePanelByEditor 的复杂度。
 * 调用时机：updatePanelByEditor 中确认 Protyle 有效时。
 */
const updateActiveProtyle = (protyle: IProtyle, options: { resize: boolean, focus: boolean, pushBackStack: boolean },
    fileDock: DockDomain | undefined) => {
    // 意图：响应调整大小的请求，例如当侧边栏展开/收起时需要重绘编辑器。
    if (options.resize) {
        resize(protyle);
    }
    // 意图：当需要聚焦编辑器时（即编辑模式），执行聚焦逻辑。
    if (options.focus) {
        restoreFocus(protyle);
    }
    // 意图：如果同时需要记录后退栈，则进行记录。
    if (options.focus && options.pushBackStack) {
        recordPushBack(protyle);
    }
    updateFileTreeSelection(protyle, fileDock);

    for (const item of protyle.app.plugins) {
        item.eventBus.emit("switch-protyle", { protyle });
    }
};

/**
 * 还原编辑器焦点
 *
 * 意图：根据当前状态将焦点还原到编辑器中的选区或第一个块。
 */
const restoreFocus = (protyle: IProtyle) => {
    const range = protyle.toolbar?.range;

    // 意图：如果工具栏上有选中范围，优先聚焦该范围。
    if (range) {
        focusByRange(range);
        countSelectWord(range, protyle.block.rootID, protyle.options.status);
        return;
    }

    // 意图：如果没有选区，则聚焦第一个块。
    countBlockWord([], protyle.block.rootID, false, protyle.options.status);
    const firstElement = protyle.wysiwyg?.element.firstElementChild;
    if (firstElement) {
        focusBlock(firstElement);
    }
};

/**
 * 记录编辑器状态到后退栈
 *
 * 意图：在编辑模式下，将当前光标位置或第一个块的位置加入后退栈。
 */
const recordPushBack = (protyle: IProtyle) => {

    const range = protyle.toolbar?.range;
    // 意图：若有选中范围，将其加入后退栈。
    if (range) {
        pushBack(protyle, range);
        return;
    }

    // 意图：若无选区但有第一个块，将第一个块的位置加入后退栈。
    const firstElement = protyle.wysiwyg?.element.firstElementChild;
    if (firstElement) {
        pushBack(protyle, undefined, firstElement);
    }
};



