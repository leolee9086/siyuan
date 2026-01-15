import { Constants } from "../../constants";
import { openFileById } from "../../editor/utils.openFileById";
import { openMobileFileById } from "../../mobile/editor";
import { zoomOut } from "../protyle.zoomOut";

/**
 * 作用：处理 Protyle 编辑器的后退/返回上一级操作。
 * 意图：根据当前编辑器是否处于全显示模式（showAll），决定是打开上级文档还是执行缩小（zoomOut）操作，实现层级导航。
 * 调用时机：用户点击面包屑、使用后退快捷键或在菜单中选择返回上一级时。
 * 问题/改进：目前逻辑较清晰，暂无已知问题。
 */
export const enterBack = (protyle: IProtyle, id: string) => {
    const parent2ID = protyle.block.parent2ID;
    if (protyle.block.showAll && parent2ID) {
        zoomOut({ protyle, id: parent2ID, focusId: id });
        return;
    }
    if (protyle.block.showAll) {
        return;
    }
    const ids = protyle.path.split("/");
    if (ids.length > 2) {
        /// #if MOBILE
        openMobileFileById(protyle.app, ids[ids.length - 2], [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]);
        /// #else
        openFileById({
            app: protyle.app,
            id: ids[ids.length - 2],
            action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
        });
        /// #endif
    }
};
