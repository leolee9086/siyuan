/** 用途：编辑器选区聚焦。使用范围：插入块后恢复光标位置。解耦评估：通过 ./imports 转发。 */
import { focusByWbr } from "./imports";
/** 用途：编辑器选区范围获取。使用范围：插入块后获取选区。解耦评估：通过 ./imports 转发。 */
import { getEditorRange } from "./imports";
import { getUndoFocusContext } from "./imports";
/** 用途：列表排序更新。使用范围：插入有序列表项后更新编号。解耦评估：通过 ./imports 转发。 */
import { updateListOrder } from "./imports";
/** 用途：事务处理。使用范围：块插入/更新操作。解耦评估：通过 ./imports 转发。 */
import { transaction } from "./imports";
/** 用途：合并为一个事务。使用范围：合并块操作。解耦评估：通过 ./imports 转发。 */
import { turnsIntoOneTransaction } from "./imports";
/** 用途：更新事务。使用范围：事务更新。解耦评估：通过 ./imports 转发。 */
import { updateTransaction } from "./imports";
/** 用途：滚动居中。使用范围：插入块后滚动到目标。解耦评估：通过 ./imports 转发。 */
import { scrollCenter } from "./imports";
/** 用途：系统常量。使用范围：配置和操作常量。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：网络请求。使用范围：获取块兄弟 ID。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：国际化文案。使用范围：块类型名称。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取拼写检查配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：获取插入目标块。使用范围：插入空块定位。解耦评估：同目录模块直接导入。 */
import { getInsertTargetBlock } from "./util.getInsertTargetBlock";
/** 用途：创建新块元素。使用范围：插入空块创建元素。解耦评估：同目录模块直接导入。 */
import { createNewBlockElement } from "./util.createNewBlockElement";
export { genEmptyBlock, genEmptyElement, genHeadingElement } from "./element.factory";

/**
 * 作用：处理跳转到父/子/兄弟块的后端响应。
 * 意图：将回调逻辑抽离为具名函数，降低 jumpToParent 的嵌套层级并提升可读性。
 */
const handleBlockSiblingResponse = (
    protyle: IProtyle,
    type: "parent" | "next" | "previous",
    response: IWebSocketData
) => {
    const targetId = response.data[type];
    if (!targetId) {
        return;
    }
    const action = targetId !== protyle.block.rootID && protyle.block.showAll ?
        [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] :
        [Constants.CB_GET_FOCUS];
    void protyle.app.openBlock({id: targetId, action});
};

/**
 * 作用：跳转到当前块的父/子/兄弟块。
 * 意图：通过后端接口获取目标块 ID 后，交由完整 AppFacade.openBlock 选择宿主导航实现。
 * 调用时机：在块面包屑或块标菜单中点击跳转按钮时调用。
 * @柯里化 闭包捕获 protyle 上下文用于打开文件
 * @同步豁免: 生命周期 使用回调式网络请求，不阻塞调用栈
 */
export const jumpToParent = (
    protyle: IProtyle,
    nodeElement: Element,
    type: "parent" | "next" | "previous"
) => {
    fetchPost("/api/block/getBlockSiblingID", {
        id: nodeElement.getAttribute("data-node-id"),
        notebook: protyle.notebookId,
    },
        response => handleBlockSiblingResponse(protyle, type, response));
};

/**
 * 作用：根据插入位置构建非列表场景的事务操作数组。
 * 意图：消除 insertEmptyBlock 中的位置分支，降低主函数复杂度。
 * @显式返回类型原因 返回类型与 IOperation 精确对齐，防止插入操作构造遗漏 required 字段。
 */
const buildInsertOperations = (
    newElement: HTMLElement,
    newId: string,
    blockElement: Element,
    position: InsertPosition
): IOperation[] => {
    const blockId = blockElement.getAttribute("data-node-id") || "";
    if (position === "beforebegin") {
        return [{
            action: "insert",
            data: newElement.outerHTML,
            id: newId || "",
            nextID: blockId,
        }];
    }
    return [{
        action: "insert",
        data: newElement.outerHTML,
        id: newId || "",
        previousID: blockId || undefined,
    }];
};

/** 插入空块 */
export const insertEmptyBlock = async (
    protyle: IProtyle,
    position: InsertPosition,
    target?: string | Element
) => {
    const range = getEditorRange(protyle.wysiwyg.element);
    const blockElement = getInsertTargetBlock(protyle, target, position);
    if (!blockElement) {
        return;
    }
    const undoFocusContext = getUndoFocusContext(protyle.wysiwyg.element, range);
    protyle.observerLoad?.disconnect();
    const { newElement, orderIndex } = createNewBlockElement(blockElement, position);
    const blockParent = blockElement.parentElement;
    const parentOldHTML = blockParent?.outerHTML ?? "";
    const newId = newElement.getAttribute("data-node-id");
    blockElement.insertAdjacentElement(position, newElement);
    // 有序列表项插入需要同步更新编号，记录父元素快照用于撤销
    const isOrderedListItem = blockElement.getAttribute("data-type") === "NodeListItem" &&
        blockElement.getAttribute("data-subtype") === "o" &&
        !newElement.parentElement?.classList.contains("protyle-wysiwyg");
    // 列表项插入后立即更新序号并记录事务快照，使撤销可恢复父元素原始序号状态
    if (isOrderedListItem && newElement.parentElement) {
        const listParent = newElement.parentElement;
        updateListOrder(listParent, orderIndex);
        updateTransaction(protyle, listParent, parentOldHTML, undoFocusContext);
    }
    // 非列表项场景通过事务记录插入操作，支持撤销
    if (!isOrderedListItem) {
        const doOperations = buildInsertOperations(newElement, newId || "", blockElement, position);
        const undoOperations: IOperation[] = [{
            action: "delete",
            id: newId || "",
            context: undoFocusContext,
        }];
        if (blockElement.parentElement?.classList.contains("sb") &&
            blockElement.parentElement.getAttribute("data-sb-layout") === "col") {
            // 合并到同一个 transaction，避免新超级块 id 在第二个 transaction 中找不到。
            const prev = blockElement.previousElementSibling;
            const next = blockElement.nextElementSibling;
            const selectsElement = position === "afterend" ? [blockElement, next] : [prev, blockElement];
            if (selectsElement.every(item => item instanceof Element)) {
                const mergeOperations = await turnsIntoOneTransaction({
                    protyle,
                    selectsElement: selectsElement as Element[],
                    type: "BlocksMergeSuperBlock",
                    level: "row",
                    unfocus: true,
                    getOperations: true,
                });
                if (mergeOperations) {
                    doOperations.push(...mergeOperations.doOperations);
                    undoOperations.splice(0, 0, ...mergeOperations.undoOperations);
                }
            }
        }
        transaction(protyle, doOperations, undoOperations);
    }
    // 插入后恢复光标位置
    if (protyle.wysiwyg?.element) {
        focusByWbr(protyle.wysiwyg.element, range);
    }
    scrollCenter(protyle);
};

/** 根据块类型获取语言名称 */
export const getLangByType = (type: string) => {
    const langMap: { [key: string]: string } = {
        "NodeIFrame": "IFrame",
        "NodeAttributeView": siyuanI18n.database,
        "NodeThematicBreak": siyuanI18n.line,
        "NodeWidget": siyuanI18n.widget,
        "NodeVideo": siyuanI18n.video,
        "NodeAudio": siyuanI18n.audio,
        "NodeBlockQueryEmbed": siyuanI18n.blockEmbed,
    };
    return langMap[type] || type;
};
