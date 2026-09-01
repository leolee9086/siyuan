/** 用途：编辑器选区聚焦。使用范围：插入块后恢复光标位置。解耦评估：通过 ./imports 转发。 */
import { focusByWbr } from "./util/imports";
/** 用途：编辑器选区范围获取。使用范围：插入块与跳转流程获取选区。解耦评估：通过 ./imports 转发。 */
import { getEditorRange } from "./util/imports";
import { getUndoFocusContext } from "./util/imports";
/** 用途：列表排序更新。使用范围：插入有序列表项后更新编号。解耦评估：通过 ./imports 转发。 */
import { updateListOrder } from "./util/imports";
/** 用途：事务处理。使用范围：块插入/更新操作。解耦评估：通过 ./imports 转发。 */
import { transaction } from "./util/imports";
/** 用途：合并为一个事务。使用范围：合并块操作。解耦评估：通过 ./imports 转发。 */
import { turnsIntoOneTransaction } from "./util/imports";
/** 用途：更新事务。使用范围：事务更新。解耦评估：通过 ./imports 转发。 */
import { updateTransaction } from "./util/imports";
/** 用途：滚动居中。使用范围：插入块后滚动到目标。解耦评估：通过 ./imports 转发。 */
import { scrollCenter } from "./util/imports";
/** 用途：系统常量。使用范围：配置和操作常量。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./util/imports";
/** 用途：网络请求。使用范围：获取块兄弟 ID 与折叠状态。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./util/imports";
/** 用途：国际化文案。使用范围：块类型名称。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./util/imports";
/** 用途：清理选中态 UI。使用范围：超级块列插入前取消多选。解耦评估：通过 ./imports 转发。 */
import { hideElements } from "./util/imports";
/** 用途：定位最近块祖先。使用范围：超级块列插入的默认目标。解耦评估：通过 ./imports 转发。 */
import { hasClosestBlock } from "./util/imports";
/** 用途：聚焦指定选区。使用范围：跳转到根块时聚焦父文档标题。解耦评估：./imports 未转发该能力，直接依赖唯一选区实现。 */
import { focusByRange } from "../protyle/util/selection.focus";
/** 用途：判断元素是否位于嵌入块内。使用范围：查询跳转目标时排除嵌入副本。解耦评估：./imports 未转发该能力，直接依赖唯一块关系实现。 */
import { isInEmbedBlock } from "../protyle/util/hasClosest";
/** 用途：运行时移动端判定。使用范围：桌面端导航历史写入的平台守卫。解耦评估：平台检测模块唯一实现，直接导入。 */
import { isMobile } from "../platform";
/** 用途：创建空段落元素。使用范围：超级块列插入新块。解耦评估：元素工厂已拆分至独立模块，经此直接导入。 */
import { genEmptyElement } from "./element.factory";
/** 用途：定位横向超级块的直属列子块。使用范围：超级块列插入的锚点定位。解耦评估：同域纯函数模块直接导入。 */
import {getHorizontalSuperBlockChild} from "./superBlock/horizontalChild";
/** 用途：刷新拖拽手柄并持久化列宽变更。使用范围：超级块列插入后的布局同步。解耦评估：显式指向 superBlock 目录入口，避免与同名纯函数文件混淆。 */
import { refreshSbAndPersistWidth } from "./superBlock/index";
/** 用途：跳转焦点决策纯函数。使用范围：父子跳转的聚焦判断。解耦评估：纯函数已拆分至独立模块，便于单测覆盖。 */
import { shouldFocusJumpTarget, shouldFocusParentDocumentTitle } from "./jumpToParent";
/** 用途：获取插入目标块。使用范围：插入空块定位。解耦评估：同目录模块直接导入。 */
import { getInsertTargetBlock } from "./util.getInsertTargetBlock";
/** 用途：创建新块元素。使用范围：插入空块创建元素。解耦评估：同目录模块直接导入。 */
import { createNewBlockElement } from "./util.createNewBlockElement";
export { genEmptyBlock, genEmptyElement, genHeadingElement } from "./element.factory";
/** 兼容转发：取消超级块实现已拆分至独立模块；保留综合入口导出以兼容既有调用方。 */
export { cancelSB } from "./util.cancelSB";
/** 兼容转发：超级块 DOM 工具已拆分至独立模块；保留综合入口导出以兼容既有调用方。 */
export { genSBElement, refreshSbResize, rebalanceSbWidth, refreshSbAndPersistWidth } from "./superBlock/index";

/**
 * 作用：处理跳转到父/子/兄弟块的后端响应。
 * 意图：将回调逻辑抽离为具名函数，降低 jumpToParent 的嵌套层级并提升可读性；
 * 先判断是否应聚焦父文档标题（含后退历史记录与缩放回根），否则按折叠状态决定导航动作，
 * 最终统一交由 AppFacade.openBlock 选择宿主导航实现。
 */
const handleBlockSiblingResponse = async (
    protyle: IProtyle,
    nodeElement: Element,
    type: "parent" | "next" | "previous",
    response: IWebSocketData
) => {
    // 导航会改变选区，后退历史所需的原始选区必须在响应处理前读取；移动端没有后退历史。
    const previousRange = isMobile ? undefined : getEditorRange(nodeElement);
    const targetId = response.data[type];
    if (!targetId) {
        return;
    }
    const titleElement = protyle.title?.editElement;
    if (shouldFocusParentDocumentTitle({
        isRoot: targetId === protyle.block.rootID,
        hasTitle: Boolean(titleElement),
        isBacklink: Boolean(protyle.options.backlinkData),
    })) {
        let pushBack: typeof import("../navigation/history/pushBack").pushBack | undefined;
        if (!isMobile) {
            try {
                ({pushBack} = await import("../navigation/history/pushBack"));
            } catch (error) {
                console.error("Failed to load the back-forward module", error);
            }
        }
        const focusTitle = () => {
            const range = titleElement.ownerDocument.createRange();
            range.selectNodeContents(titleElement);
            range.collapse(false);
            focusByRange(range);
            protyle.toolbar.range = range;
            protyle.contentElement.scrollTop = 0;
            if (!isMobile) {
                pushBack?.(protyle, range, titleElement);
            }
        };
        if (!isMobile) {
            pushBack?.(protyle, previousRange);
        }
        if (protyle.block.showAll) {
            const {zoomOut} = await import("../menus/protyle");
            zoomOut({
                protyle,
                id: protyle.block.rootID,
                callback: focusTitle,
                reload: true,
            });
        } else {
            focusTitle();
        }
        return;
    }
    fetchPost("/api/block/checkBlockFold", {
        id: targetId,
        notebook: protyle.notebookId,
    }, (foldResponse) => {
        const targetElement = Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${targetId}"]`))
            .find(item => !isInEmbedBlock(item));
        // 折叠或当前视口内不可见的目标需要携带 CB_GET_ALL 展开内容，可见目标仅聚焦即可。
        const shouldFocus = shouldFocusJumpTarget({
            isRoot: targetId === protyle.block.rootID,
            showAll: protyle.block.showAll,
            isFolded: foldResponse.data.isFolded,
            isHidden: !targetElement || targetElement.clientHeight === 0,
        });
        const action: TProtyleAction[] = shouldFocus ?
            [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] :
            [Constants.CB_GET_FOCUS];
        void protyle.app.openBlock({id: targetId, action});
    });
};

/**
 * 作用：跳转到当前块的父/子/兄弟块。
 * 意图：通过后端接口获取目标块 ID 后，交由完整 AppFacade.openBlock 选择宿主导航实现；
 * 响应处理抽离至 handleBlockSiblingResponse，统一承载父文档标题聚焦与折叠感知的聚焦决策。
 * 调用时机：在块面包屑或块标菜单中点击跳转按钮时调用。
 * @柯里化 闭包捕获 protyle 上下文用于打开文件
 * @同步豁免: 生命周期 使用回调式网络请求，不阻塞调用栈；异步响应经 void 显式不等待。
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
        response => {
            void handleBlockSiblingResponse(protyle, nodeElement, type, response);
        });
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
                // 以光标所在块作为宽度继承源，保证向有宽度的块之前插入时新超级块的宽度来源正确。
                const turnOptions = {
                    protyle,
                    selectsElement: selectsElement as Element[],
                    type: "BlocksMergeSuperBlock" as const,
                    level: "row" as const,
                    unfocus: true,
                    getOperations: true,
                    widthSourceElement: blockElement as HTMLElement,
                };
                const mergeOperations = await turnsIntoOneTransaction(turnOptions);
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

/**
 * 作用：在横向超级块中目标列的左/右侧插入一个空的段落列。
 * 意图：先定位光标或选区所在的直属列子块，插入空块后刷新拖拽手柄并把列宽再平衡并入同一事务，
 * 保证撤销时结构、焦点与列宽一并恢复。
 * 调用时机：块标菜单“向左/向右插入”与对应快捷键触发时调用。
 */
export const insertEmptySuperBlockColumn = (protyle: IProtyle, position: "left" | "right", target?: Element) => {
    const range = getEditorRange(protyle.wysiwyg.element);
    let blockElement = target;
    if (!blockElement) {
        const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
        if (selectElements.length > 0) {
            blockElement = position === "left" ? selectElements[0] : selectElements[selectElements.length - 1];
        } else {
            blockElement = hasClosestBlock(range.startContainer) as HTMLElement;
        }
    }
    const columnElement = getHorizontalSuperBlockChild(blockElement, protyle.wysiwyg.element);
    if (!columnElement) {
        return false;
    }

    const undoFocusContext = getUndoFocusContext(protyle.wysiwyg.element, range);
    hideElements(["select"], protyle);
    const newElement = genEmptyElement(false, true);
    const newId = newElement.getAttribute("data-node-id") || "";
    const columnId = columnElement.getAttribute("data-node-id") || "";
    const doOperations: IOperation[] = [{
        action: "insert",
        data: newElement.outerHTML,
        id: newId,
        parentID: columnElement.parentElement?.getAttribute("data-node-id") || undefined,
        nextID: position === "left" ? columnId : undefined,
        previousID: position === "right" ? columnId : undefined,
    }];
    const undoOperations: IOperation[] = [{
        action: "delete",
        id: newId,
        context: undoFocusContext,
    }];
    protyle.observerLoad?.disconnect();
    columnElement.insertAdjacentElement(position === "left" ? "beforebegin" : "afterend", newElement);
    refreshSbAndPersistWidth(columnElement.parentElement, doOperations, undoOperations);
    transaction(protyle, doOperations, undoOperations);
    focusByWbr(protyle.wysiwyg.element, range);
    scrollCenter(protyle);
    return true;
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
