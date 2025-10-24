import { Files } from "../layout/dock/Files";
import { getAllModels } from "../layout/getAll";
import { countSelectWord, countBlockWord } from "../layout/status";
import { getDockByType } from "../layout/tabUtil";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { resize } from "../protyle/util/resize";
import { focusByRange, focusBlock } from "../protyle/util/selection";
import { pushBack } from "../util/backForward";
import { updateBacklinkGraph } from "./util.updateBacklinkGraph";
import { updateOutline } from "./util.updateOutline";


export const updatePanelByEditor = (options: {
    protyle?: IProtyle;
    focus: boolean;
    pushBackStack: boolean;
    reload: boolean;
    resize: boolean;
}) => {
    if (options.protyle && options.protyle.path) {
        // https://ld246.com/article/1637636106054/comment/1641485541929#comments
        if (options.protyle.element.classList.contains("fn__none") ||
            (!hasClosestByClassName(options.protyle.element, "layout__wnd--active") &&
                document.querySelector(".layout__wnd--active") // https://github.com/siyuan-note/siyuan/issues/4414
            )) {
            return;
        }
        if (options.resize) {
            resize(options.protyle);
        }
        if (options.focus) {
            if (options.protyle.toolbar.range) {
                focusByRange(options.protyle.toolbar.range);
                countSelectWord(options.protyle.toolbar.range, options.protyle.block.rootID);
                if (options.pushBackStack && options.protyle.preview.element.classList.contains("fn__none")) {
                    pushBack(options.protyle, options.protyle.toolbar.range);
                }
            } else {
                focusBlock(options.protyle.wysiwyg.element.firstElementChild);
                if (options.pushBackStack && options.protyle.preview.element.classList.contains("fn__none")) {
                    pushBack(options.protyle, undefined, options.protyle.wysiwyg.element.firstElementChild);
                }
                countBlockWord([], options.protyle.block.rootID);
            }
        }
        if (window.siyuan.config.fileTree.alwaysSelectOpenedFile && options.protyle) {
            const fileModel = getDockByType("file")?.data.file;
            if (fileModel instanceof Files) {
                const target = fileModel.element.querySelector(`li[data-path="${options.protyle.path}"]`);
                if (!target || (target && !target.classList.contains("b3-list-item--focus"))) {
                    fileModel.selectItem(options.protyle.notebookId, options.protyle.path);
                }
            }
        }
        options.protyle.app.plugins.forEach(item => {
            item.eventBus.emit("switch-protyle", { protyle: options.protyle });
        });
    }
    // 切换页签或关闭所有页签时，需更新对应的面板
    const models = getAllModels();
    updateOutline(models, options.protyle, options.reload);
    updateBacklinkGraph(models, options.protyle);
};
