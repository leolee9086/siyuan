import { fetchPost } from "../../../ai/imports";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { focusBlock } from "../../util/selection";
import { handleGoEndResponse } from "./commonHotkeyHelper";

/**
 * 跳转到文档末尾。
 *
 * @description
 * - 作用：将编辑器视口滚动到文档末尾，并将光标定位到最后一个块。
 * - 意图：与 `goHome` 配对，提供快速导航到文档尾部的能力。
 * - 调用时机：
 *   - 用户按下 Ctrl+End 快捷键时
 *   - 用户点击滚动条的向下箭头按钮时
 *
 * @param protyle - 编辑器实例
 */

export const goEnd = (protyle: IProtyle) => {
    const lastElement = protyle.wysiwyg?.element?.lastElementChild;
    if (!lastElement) {
        return;
    }
    if (protyle.scroll && !protyle.scroll.element.classList.contains("fn__none") &&
        lastElement.getAttribute("data-eof") !== "2") {
        fetchPost("/api/filetree/getDoc", {
            id: protyle.block.rootID,
            mode: 4,
            size: getSiyuanConfig().editor.dynamicLoadBlocks,
        }, getResponse => {
            handleGoEndResponse(protyle, getResponse);
        });
        return;
    }
    if (protyle.contentElement) {
        protyle.contentElement.scrollTop = protyle.contentElement.scrollHeight;
    }
    if (protyle.contentElement && protyle.scroll) {
        protyle.scroll.lastScrollTop = protyle.contentElement.scrollTop;
    }
    focusBlock(lastElement, undefined, false);
};
