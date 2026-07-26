/** 用途：创建空块。使用范围：删除最后一个顶层块后的恢复。解耦评估：经本子域网关直达块工厂。 */
import {genEmptyElement} from "./imports";
/** 用途：定位顶层块。使用范围：跨文档移动清理。解耦评估：经本子域网关直达查询实现。 */
import {getTopAloneElement} from "./imports";
/** 用途：验证块与操作身份。使用范围：空编辑器恢复和顶层删除。解耦评估：经本子域网关直达事务身份规则。 */
import {requireTransactionIdentity} from "./imports";

/** 删除后为空的编辑器同步恢复可编辑状态。 */
const restoreEmptyEditor = (protyle: IProtyle, doOperations: IOperation[]) => {
    const wysiwyg = protyle.wysiwyg;
    if (!wysiwyg) {
        throw new Error("Transaction empty-editor recovery requires wysiwyg runtime");
    }
    if (wysiwyg.element.childElementCount !== 0) {
        return;
    }
    const rootID = requireTransactionIdentity(protyle.block.rootID, "block root ID");
    const blockID = requireTransactionIdentity(protyle.block.id, "block ID");
    // 非根文档删除至空时回到根视图，由 zoomOut 负责恢复内容。
    if (rootID !== blockID) {
        protyle.getInstance().zoomOut({
            id: rootID,
            isPushBack: false,
            focusId: blockID,
        });
        return;
    }
    const newId = Lute.NewNodeID();
    const newElement = genEmptyElement(false, false, newId);
    doOperations.push({
        action: "insert",
        data: newElement.outerHTML,
        id: newId,
        parentID: protyle.block.parentID
    });
    wysiwyg.element.innerHTML = newElement.outerHTML;
};

/**
 * 删除跨文档移动后的顶层元素并返回需要继续提交的操作。
 * @同步豁免: 需要绝对同步的DOM访问 - 删除、空块恢复和操作采集必须在当前移动流程中连续完成
 */
export const removeTopElementAndCollectOperations = (updateElement: Element, protyle: IProtyle) => {
    // 移动到其他文档中，该块需移除
    // TODO 文档没有打开时，需要通过后台获取 getTopAloneElement
    const topAloneElement = getTopAloneElement(updateElement);
    const doOperations: IOperation[] = [];
    // 删除目标位于容器内部时，额外记录被一并移除的顶层容器。
    if (topAloneElement !== updateElement) {
        updateElement.remove();
        doOperations.push({
            action: "delete",
            id: requireTransactionIdentity(topAloneElement.getAttribute("data-node-id"), "top element ID")
        });
    }
    topAloneElement.remove();
    restoreEmptyEditor(protyle, doOperations);
    return doOperations;
};
