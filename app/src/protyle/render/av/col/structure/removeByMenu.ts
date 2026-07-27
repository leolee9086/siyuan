/** 用途：生成删除更新时间；使用范围：列菜单删除；解耦评估：经同域网关取得纯时间依赖。 */
import {dayjs} from "./imports";
/** 用途：提交封闭的列结构事务；使用范围：列菜单删除；解耦评估：经同域网关直达严格命令。 */
import {submitAVColumnStructureTransaction} from "./imports";
/** 用途：执行删除列 DOM 呈现；使用范围：列菜单删除；解耦评估：同域唯一叶子实现。 */
import {removeAttrViewColPresentation} from "./presentation";

/**
 * 从列菜单提交删除及精确 undo，并立即同步当前 DOM 和更新时间。
 * 由普通列删除、关系列删除确认及无需确认的删除入口调用；双向目标是否一并删除由调用方通过 removeDest 明确决定。
 * 当前保留既有先提交、后移除 DOM、再回写 updated 的顺序，后续 Panel 删除与菜单删除可共享参数领域类型，但不合并宿主交互决策。
 */
/** @同步豁免: UI构建 - 事务、DOM 移除与 updated 回写必须处于同一菜单点击栈。 */
export const removeColByMenu = (options: {
    protyle: IProtyle;
    colId: string;
    avID: string;
    blockID: string;
    oldValue: string;
    type: TAVCol;
    cellElement: HTMLElement;
    blockElement: Element;
    removeDest: boolean;
}) => {
    const newUpdated = dayjs().format("YYYYMMDDHHmmss");
    submitAVColumnStructureTransaction(options.protyle, [{
        action: "removeAttrViewCol",
        id: options.colId,
        avID: options.avID,
        removeDest: options.removeDest
    }, {
        action: "doUpdateUpdated",
        id: options.blockID,
        data: newUpdated,
    }], [{
        action: "addAttrViewCol",
        name: options.oldValue,
        avID: options.avID,
        type: options.type,
        id: options.colId,
        previousID: options.cellElement.previousElementSibling?.getAttribute("data-col-id") || "",
    }, {
        action: "doUpdateUpdated",
        id: options.blockID,
        data: options.blockElement.getAttribute("updated")
    }]);
    removeAttrViewColPresentation(options.blockElement, options.colId);
    options.blockElement.setAttribute("updated", newUpdated);
};
