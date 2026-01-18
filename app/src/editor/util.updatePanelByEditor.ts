import { Files } from "../layout/dock/Files";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
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
    /**
     * 意图：确保存在有效的编辑器实例且该编辑器已关联特定的文档路径。
     * 只有当编辑器加载了具体的文档（拥有 path）时，才进行后续的 UI 更新操作（如调整大小、设置焦点、同步文件树选中状态等）。
     *
     * 生效场景：
     * 1. 传入了 `protyle` 对象。
     * 2. 该 `protyle` 对象具有非空的 `path` 属性（即关联了实际文档）。
     * 如果 protyle 为空或未关联文档，则不执行针对特定文档的面板更新逻辑。
     */
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
    /// #if !MOBILE
    const models = getAllModels();
    updateOutline(models, protyle, options.reload);
    updateBacklinkGraph(models, protyle);
    /// #endif
};
