import { Constants } from "../../constants";
import { openFileById } from "../../editor/utils.openFileById";
import { openMobileFileById } from "../../mobile/editor";
import { isMobile } from "../../platform";
import { zoomOut } from "./protyle.zoomOut";

/**
 * @AIDONE 每一个分支都应该添加注释说明
 * 作用：处理 Protyle 编辑器的后退/返回上一级操作。
 * 意图：根据当前编辑器是否处于全显示模式（showAll），决定是打开上级文档还是执行缩小（zoomOut）操作，实现层级导航。
 * 调用时机：用户点击面包屑、使用后退快捷键或在菜单中选择返回上一级时。
 * 问题/改进：目前逻辑较清晰，暂无已知问题。
 */
export const enterBack = (protyle: IProtyle, id: string) => {
    const parent2ID = protyle.block.parent2ID;
    // 如果当前处于全页显示模式且存在上一级块 ID，则缩小视图至上一级
    if (protyle.block.showAll && parent2ID) {
        zoomOut({ protyle, id: parent2ID, focusId: id });
        return;
    }
    // 如果处于全页显示模式但没有上一级 ID，则直接返回（可能是根节点）
    if (protyle.block.showAll) {
        return;
    }
    // 如果缺失路径信息，无法进行后退操作
    if (!protyle.path) {
        return;
    }
    const ids = protyle.path.split("/");
    // 如果路径层级不足（无法回退到上一级），直接返回
    if (ids.length <= 2) {
        return;
    }
    const parentId = ids[ids.length - 2];
    // 如果上一级页面 ID 无效，直接返回
    if (!parentId) {
        return;
    }
    // 移动端使用移动端文件打开方式
    if (isMobile) {
        openMobileFileById(protyle.app, parentId, [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]);
        return;
    }
    // 桌面端使用标准文件打开方式
    openFileById({
        app: protyle.app,
        id: parentId,
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
    });
};
