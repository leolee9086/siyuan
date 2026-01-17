import { Files } from "../layout/dock/Files";
import { getAllModels } from "../layout/getAll";
import { countSelectWord, countBlockWord } from "../layout/status";
import { getDockByType } from "../layout/tabUtil";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { resize } from "../protyle/util/resize";
import { focusByRange, focusBlock } from "../protyle/util/selection";
import { pushBack } from "../util/backForward";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { updateBacklinkGraph } from "./util.updateBacklinkGraph";
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
export const updatePanelByEditor = (options: {
    protyle?: IProtyle,
    focus: boolean,
    pushBackStack: boolean,
    reload: boolean,
    resize: boolean
}) => {
    const protyle = options.protyle;
    if (protyle && protyle.path) {
        if (protyle.element.classList.contains("fn__none")) {
            return;
        }
        if (options.resize) {
            resize(protyle);
        }
        if (options.focus) {
            if (protyle.toolbar.range) {
                focusByRange(protyle.toolbar.range);
                countSelectWord(protyle.toolbar.range, protyle.block.rootID);
                if (options.pushBackStack && protyle.preview.element.classList.contains("fn__none")) {
                    pushBack(protyle, protyle.toolbar.range);
                }
            } else {
                const firstElement = protyle.wysiwyg.element.firstElementChild;
                if (firstElement) {
                    focusBlock(firstElement);
                    if (options.pushBackStack && protyle.preview.element.classList.contains("fn__none")) {
                        pushBack(protyle, undefined, firstElement);
                    }
                }
                countBlockWord([], protyle.block.rootID);
            }
        }
        if (getSiyuanConfig().fileTree.alwaysSelectOpenedFile) {
            const fileModel = getDockByType("file")?.data.file;
            if (fileModel instanceof Files) {
                const target = fileModel.element.querySelector(`li[data-path="${protyle.path}"]`);
                if (!target || !target.classList.contains("b3-list-item--focus")) {
                    fileModel.selectItem(protyle.notebookId, protyle.path);
                }
            }
        }
        protyle.app.plugins.forEach(item => {
            item.eventBus.emit("switch-protyle", { protyle });
        });
    }
    // 切换页签或关闭所有页签时，需更新对应的面板
    const models = getAllModels();
    updateOutline(models, protyle, options.reload);
    updateBacklinkGraph(models, protyle);
};
