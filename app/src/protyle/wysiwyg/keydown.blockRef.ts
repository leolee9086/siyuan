import { hasClosestByAttribute } from "../util/hasClosest";
import { matchHotKey } from "../util/hotKey";
import { Constants } from "../../constants";
import {checkFold} from "../../block/fold/checkFold";
import { openFileById } from "../../editor/utils.openFileById";
import { BlockPanel } from "../../block/panel/Panel";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMobile } from "../../platform";

/**
 * 块引用处理中间件
 * 处理块引用相关的键盘快捷键操作
 */
export const blockRefMiddleware = async (
    event: KeyboardEvent,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    range: Range,
    controller: AbortController
) => {
    if (isMobile) {
        return false;
    }
    const refElement = hasClosestByAttribute(range.startContainer, "data-type", "block-ref");
    if (refElement) {
        const id = (refElement.getAttribute("data-id") || "").split(/\s+/)[0];

        if (!id) {
            return false;
        }

        if (matchHotKey(getSiyuanConfig().keymap.editor.general.openBy.custom, event)) {
            checkFold(id, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id,
                    action,
                    zoomIn
                });
            });
            event.preventDefault();
            event.stopPropagation();
            controller.abort("块引用打开处理");
            return true;
        } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.refTab.custom, event)) {
            // 打开块引和编辑器中引用、反链、书签中点击事件需保持一致，都加载上下文
            checkFold(id, (zoomIn) => {
                openFileById({
                    app: protyle.app,
                    id,
                    action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                    keepCursor: true,
                    zoomIn
                });
            });
            event.preventDefault();
            event.stopPropagation();
            controller.abort("块引用标签页打开处理");
            return true;
        } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertRight.custom, event)) {
            checkFold(id, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id,
                    position: "right",
                    action,
                    zoomIn
                });
            });
            event.preventDefault();
            event.stopPropagation();
            controller.abort("块引用右侧插入处理");
            return true;
        } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.insertBottom.custom, event)) {
            checkFold(id, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id,
                    position: "bottom",
                    action,
                    zoomIn
                });
            });
            event.preventDefault();
            event.stopPropagation();
            controller.abort("块引用底部插入处理");
            return true;
        } else if (matchHotKey(getSiyuanConfig().keymap.editor.general.refPopover.custom, event)) {
            // open popover
            window.siyuan.blockPanels.push(new BlockPanel({
                app: protyle.app,
                isBacklink: false,
                targetElement: refElement,
                refDefs: [{ refID: id }]
            }));
            event.preventDefault();
            event.stopPropagation();
            controller.abort("块引用弹出面板处理");
            return true;
        }
    }
};
