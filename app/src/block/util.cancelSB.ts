/*
 * 用途：获取超级块内可编辑元素，用于插入 wbr 光标锚点。
 * 使用范围：仅在 cancelSB 的子块提升流程中使用。
 * 解耦评估：可改由调用方传入可编辑节点实现解耦，但调用方通常只有块容器引用，
 * 将解析逻辑集中在块工具层可避免重复 DOM 遍历。
 */
import {getContenteditableElement} from "./cancelSB/imports";
/** 用途：读取嵌入父级；使用范围：cancelSB 的事务 parentID 计算；解耦评估：通过同域网关直达唯一块解析实现，避免加载 block 综合入口。 */
import {getEmbedChildOperationParentID} from "./cancelSB/imports";
/** 用途：读取普通父级；使用范围：cancelSB 的事务 parentID 计算；解耦评估：通过同域网关直达唯一块解析实现，保持 parentID 规则唯一。 */
import {getParentBlock} from "./cancelSB/imports";
/** 用途：读取前置兄弟；使用范围：cancelSB 的 do/undo 操作顺序；解耦评估：通过同域网关直达唯一块解析实现，避免重复 DOM 规则。 */
import {getPreviousBlockSibling} from "./cancelSB/imports";
/*
 * 用途：在嵌入块失效时重新触发块渲染。
 * 使用范围：仅在 cancelSB 的嵌入块后处理分支使用。
 * 解耦评估：可通过事件发射间接解耦，但会增加异步链路与状态同步复杂度，
 * 该流程需同步刷新当前编辑区，因此直接调用核心渲染函数更稳定。
 */
import {blockRender} from "./cancelSB/imports";
/*
 * 用途：在超级块结构变更后重绘数学公式。
 * 使用范围：仅在 cancelSB 完成 DOM 结构变更后执行。
 * 解耦评估：理论上可通过渲染调度器注入，但本函数已在编辑区内原子执行结构变更，
 * 直接调用可减少中间调度开销。
 */
import {mathRender} from "./cancelSB/imports";
/*
 * 用途：在插入 wbr 后恢复光标位置。
 * 使用范围：仅在 cancelSB 存在 range 且需要回填光标时使用。
 * 解耦评估：可通过注入聚焦策略解耦，但焦点恢复规则与编辑器实现强耦合，
 * 维持直接依赖可降低行为偏差。
 */
import {focusByWbr} from "./cancelSB/imports";
/*
 * 用途：解析当前块的父块节点。
 * 使用范围：仅在 cancelSB 计算 move/insert 的 parentID 时使用。
 * 解耦评估：可由调用方传入 parentID，但该值受实时 DOM 结构影响，
 * 函数内部就地解析可确保一致性。
 */
/*
 * 用途：请求后端获取块的兄弟/父级 ID。
 * 使用范围：仅在 cancelSB 的 showAll 或反链模式下兜底定位。
 * 解耦评估：可由上层预取后注入参数解耦，但会把网络编排扩散到多个调用点，
 * 当前保持在块工具层集中调用，边界更清晰。
 */
import {fetchSyncPost} from "./cancelSB/imports";

/*
 * 作用：把 DOM 属性读取结果规范为 string | undefined。
 * 意图：消除 null 与 IOperation 类型签名不一致导致的类型错误。
 * 调用时机：读取 data-node-id、parentID、previousID 后立刻调用。
 * 问题/改进：若后续统一封装 DOM id 访问层，可进一步减少重复调用。
 */
const toOptionalId = (value: string | null | undefined) => {
    if (!value) {
        return undefined;
    }
    return value;
};

/*
 * 作用：生成超级块撤销插入所需的快照 HTML。
 * 意图：确保取消超级块后仍可通过 undo 恢复原结构。
 * 调用时机：cancelSB 在写入 undo insert 操作前调用。
 * 问题/改进：当前以最后子元素为核心快照，后续可评估是否需要更完整结构校验。
 */
const buildSuperBlockSnapshot = (nodeElement: Element) => {
    const snapshotNode = nodeElement.cloneNode();
    if (!(snapshotNode instanceof HTMLElement)) {
        return "";
    }
    const lastChildHtml = nodeElement.lastElementChild?.outerHTML ?? "";
    snapshotNode.innerHTML = lastChildHtml;
    return snapshotNode.outerHTML;
};

/*
 * 作用：解析 move/insert 操作需要的 previousId 与 parentID。
 * 意图：在 showAll/反链模式下保证块定位正确，避免错误挂载位置。
 * 调用时机：cancelSB 构建 undo/do 操作之前调用。
 * 问题/改进：仍依赖同步请求，后续可在事务层统一预取位置数据。
 */
const resolvePositionIDs = async (
    protyle: IProtyle,
    id: string,
    previousId: string | undefined,
    parentID: string | undefined
) => {
    // 说明：已有定位信息时不再触发额外请求，保证性能与最小副作用。
    if (previousId || parentID) {
        return { previousId, parentID };
    }
    // 说明：showAll/反链模式下，当前块可能脱离常规文档树，需要后端返回真实位置。
    if (protyle.block.showAll || protyle.options.backlinkData) {
        const idData = await fetchSyncPost("/api/block/getBlockSiblingID", {
            id,
            notebook: protyle.notebookId,
        });
        return {
            previousId: toOptionalId(idData.data.previous),
            parentID: toOptionalId(idData.data.parent),
        };
    }
    return { previousId, parentID: toOptionalId(protyle.block.rootID) };
};

/*
 * 作用：收集超级块内可提升的子块节点集合。
 * 意图：仅处理具备 data-node-id 的真实块节点，过滤装饰性节点。
 * 调用时机：cancelSB 构建 move 操作列表前调用。
 * 问题/改进：如后续出现新的块标识规则，应同步更新过滤条件。
 */
const collectBlockChildren = (nodeElement: Element) => {
    return Array.from(nodeElement.children).filter((item) => Boolean(item.getAttribute("data-node-id")));
};

/*
 * 作用：批量生成子块移动的 do/undo 操作并回写最新 previousId。
 * 意图：保证子块提升顺序与撤销顺序一致，维持文档结构稳定。
 * 调用时机：cancelSB 在定位完成后、执行 DOM 替换前调用。
 * 问题/改进：若后续支持批量事务 API，可改为一次性提交减少数组 push 次数。
 */
const appendMoveOperations = (
    blockChildren: Element[],
    id: string,
    previousId: string | undefined,
    parentID: string | undefined,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    let currentPreviousId = previousId;
    for (const item of blockChildren) {
        const itemId = toOptionalId(item.getAttribute("data-node-id"));
        // 说明：理论上过滤后 itemId 一定存在，这里仍保留保护分支防止运行时脏数据。
        if (!itemId) {
            continue;
        }
        doOperations.push({
            action: "move",
            id: itemId,
            previousID: currentPreviousId,
            parentID,
        });
        undoOperations.push({
            action: "move",
            id: itemId,
            previousID: toOptionalId(getPreviousBlockSibling(item)?.getAttribute("data-node-id")),
            parentID: id,
        });
        currentPreviousId = itemId;
    }
    return currentPreviousId;
};

/*
 * 作用：执行超级块取消对应的 DOM 变更并处理光标恢复。
 * 意图：让视觉结构与 doOperations 保持一致，避免状态与界面不一致。
 * 调用时机：cancelSB 生成操作后立即调用。
 * 问题/改进：当前函数同时处理删除、替换与聚焦，后续可按职责进一步拆分。
 */
const applyDomChanges = (
    protyle: IProtyle,
    nodeElement: Element,
    blockChildren: Element[],
    range: Range | undefined,
    id: string,
    doOperations: IOperation[]
) => {
    doOperations.push({ action: "delete", id });
    // 说明：无子块时直接删除超级块本体，避免保留空壳节点。
    if (blockChildren.length === 0) {
        nodeElement.remove();
        return;
    }
    const editableElement = range ? getContenteditableElement(nodeElement) : undefined;
    // 说明：有选区时先植入 wbr，确保替换后仍可恢复光标。
    if (editableElement) {
        editableElement.insertAdjacentHTML("afterbegin", "<wbr>");
    }
    nodeElement.lastElementChild?.remove();
    nodeElement.replaceWith(...blockChildren);
    const wysiwygElement = protyle.wysiwyg?.element;
    // 说明：仅在编辑器容器和选区同时存在时执行光标恢复。
    if (editableElement && range && wysiwygElement) {
        focusByWbr(wysiwygElement, range);
    }
};

/*
 * 作用：针对受影响的嵌入块重置渲染标记并触发重渲染。
 * 意图：修复取消超级块后嵌入块面包屑丢失的问题。
 * 调用时机：cancelSB 在完成 DOM 调整与数学渲染后调用。
 * 问题/改进：当前逐个 querySelector，若操作量增大可评估批量索引优化。
 */
const rerenderEmbedBlocks = (protyle: IProtyle, doOperations: IOperation[]) => {
    const wysiwygElement = protyle.wysiwyg?.element;
    // 说明：编辑器容器不存在时无法执行任何重渲染。
    if (!wysiwygElement) {
        return;
    }
    for (const item of doOperations) {
        const element = wysiwygElement.querySelector(`[data-node-id="${item.id}"]`);
        // 说明：仅嵌入块需要重置 data-render 触发重新渲染面包屑。
        if (!element || element.getAttribute("data-type") !== "NodeBlockQueryEmbed") {
            continue;
        }
        element.removeAttribute("data-render");
        blockRender(protyle, element);
    }
};

/*
 * 作用：取消超级块并把其子块提升到原层级，生成对应 do/undo 操作。
 * 意图：保证用户在解除超级块包裹后，文档结构、光标位置与撤销栈保持一致。
 * 调用时机：在块编辑交互中执行“取消超级块”动作时调用。
 * 问题/改进：当前仍依赖同步接口兜底定位，后续可评估在批量编辑事务中统一预取位置数据。
 */
// 导出取消超级块能力，供块编辑流程复用。
export const cancelSB = async (
    protyle: IProtyle,
    nodeElement: Element,
    range?: Range
) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    let previousId = toOptionalId(getPreviousBlockSibling(nodeElement)?.getAttribute("data-node-id"));
    nodeElement.classList.remove("protyle-wysiwyg--select");
    nodeElement.removeAttribute("select-start");
    nodeElement.removeAttribute("select-end");
    const id = toOptionalId(nodeElement.getAttribute("data-node-id"));
    // 说明：块节点不存在 data-node-id 时无法构建操作记录，直接返回空结果。
    if (!id) {
        return { doOperations, undoOperations, previousId };
    }
    // 先清理拖拽手柄，避免手柄被克隆进撤销用的超级块副本，导致恢复后残留多余手柄。
    nodeElement.querySelectorAll(":scope > .sb__resize").forEach(handle => handle.remove());
    const parentFromDom = toOptionalId(
        getEmbedChildOperationParentID(nodeElement) || getParentBlock(nodeElement)?.getAttribute("data-node-id")
    );
    const snapshotHtml = buildSuperBlockSnapshot(nodeElement);
    const position = await resolvePositionIDs(protyle, id, previousId, parentFromDom);
    previousId = position.previousId;
    undoOperations.push({
        action: "insert",
        id,
        data: snapshotHtml,
        previousID: position.previousId,
        parentID: position.parentID,
    });
    const blockChildren = collectBlockChildren(nodeElement);
    previousId = appendMoveOperations(blockChildren, id, previousId, position.parentID, doOperations, undoOperations);
    applyDomChanges(protyle, nodeElement, blockChildren, range, id, doOperations);
    const wysiwygElement = protyle.wysiwyg?.element;
    // 说明：编辑器容器存在时才执行数学重绘，避免空引用异常。
    if (wysiwygElement) {
        mathRender(wysiwygElement);
    }
    rerenderEmbedBlocks(protyle, doOperations);
    return { doOperations, undoOperations, previousId };
};
