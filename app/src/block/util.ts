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
/** 用途：通过 ID 打开文件。使用范围：跳转到父/子块。解耦评估：通过 ./imports 转发。 */
import { openFileById } from "./imports";
/** 用途：移动端通过 ID 打开文件。使用范围：移动端块跳转。解耦评估：通过 ./imports 转发。 */
import { openMobileFileById } from "./imports";
import { isMobile } from "./imports";
/** 用途：国际化文案。使用范围：块类型名称。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取拼写检查配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：获取插入目标块。使用范围：插入空块定位。解耦评估：同目录模块直接导入。 */
import { getInsertTargetBlock } from "./util.getInsertTargetBlock";
/** 用途：创建新块元素。使用范围：插入空块创建元素。解耦评估：同目录模块直接导入。 */
import { createNewBlockElement } from "./util.createNewBlockElement";

/**
 * 作用：创建超级块 DOM 元素。
 * 意图：统一超级块的元素构造，保证 data-* 属性和内部结构一致。
 * 调用时机：在块合并操作中需要创建超级块容器时调用。
 * 问题/改进：Lute.NewNodeID() 是同步调用，不需要异步包装。
 * @同步豁免: UI构建 - 纯 DOM 元素创建与属性设置，无异步依赖。
 */
export const genSBElement = (layout: string, id?: string, attrHTML?: string) => {
    const sbElement = document.createElement("div");
    sbElement.setAttribute("data-node-id", id || Lute.NewNodeID());
    sbElement.setAttribute("data-type", "NodeSuperBlock");
    sbElement.setAttribute("class", "sb");
    sbElement.setAttribute("data-sb-layout", layout);
    sbElement.innerHTML = attrHTML || `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return sbElement;
};

/**
 * 作用：统计超级块内受 Lute 管理的真实子块数量。
 * 意图：排除 sb__resize 手柄、protyle-attr 等纯装饰元素，确保计数与被 Lute AST 识别的块节点一致。
 * 调用时机：超级块结构变更（折叠/展开/拖拽）后用于判断是否为空超级块。
 * 问题/改进：selector 规则需与 Lute 的节点识别规则保持同步。
 * @同步豁免: 需要绝对同步的DOM访问 - 实时读取 DOM 计数用于即时 UI 判断。
 */
export const getSbChildCount = (sbElement: Element) => {
    const childBlocks = sbElement.querySelectorAll(":scope > [data-node-id]");
    return childBlocks.length;
};

/**
 * 作用：刷新超级块横向布局下的拖拽手柄。
 * 意图：col 布局在每两个相邻子块间插入 sb__resize 手柄用于拖拽调整宽度，非 col 布局移除全部手柄。
 *       手柄是纯装饰元素，回流时由 lute 的 genASTByBlockDOM 按 sb__resize class 忽略，不产生幽灵块。
 * 调用时机：超级块布局切换或子块结构变化后调用。
 * 问题/改进：如果新增布局类型需要手柄，需同步更新此函数。
 * @同步豁免: 需要绝对同步的DOM访问 - DOM 手柄的插入/移除必须实时完成。
 */
export const refreshSbResize = (sbElement: Element) => {
    if (!sbElement || !sbElement.classList.contains("sb")) {
        return;
    }
    const resizeHandles = sbElement.querySelectorAll(":scope > .sb__resize");
    for (const handle of resizeHandles) {
        handle.remove();
    }
    if (sbElement.getAttribute("data-sb-layout") !== "col") {
        return;
    }
    const children = Array.from(sbElement.querySelectorAll(":scope > [data-node-id]"));
    for (let i = 0; i < children.length - 1; i++) {
        const child = children[i];
        if (!child) {
            continue;
        }
        const resizeHandle = document.createElement("span");
        resizeHandle.setAttribute("class", "sb__resize");
        resizeHandle.setAttribute("contenteditable", "false");
        child.after(resizeHandle);
    }
};

/**
 * 作用：重新分配列布局超级块中子块的宽度。
 * 意图：子块进出超级块后按现有比例归一化宽度，避免 gap 不均或换行。
 * 调用时机：拖拽、删除、插入等操作刷新超级块布局时调用。
 * @同步豁免: 需要绝对同步的DOM访问 - 需要实时读取手柄尺寸和子块宽度并立即写回 DOM。
 */
export const rebalanceSbWidth = (sbElement: Element): Array<{ id: string; oldHTML: string }> => {
    if (!sbElement || sbElement.getAttribute("data-sb-layout") !== "col") {
        return [];
    }
    const children = Array.from(sbElement.querySelectorAll(":scope > [data-node-id]")) as HTMLElement[];
    if (children.length < 2 || !children.some(child => child.style.width)) {
        return [];
    }
    const handle = sbElement.querySelector(":scope > .sb__resize") as HTMLElement | null;
    let gapPx = 20;
    if (handle) {
        const style = getComputedStyle(handle);
        gapPx = handle.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
    }
    const gapShare = ((children.length - 1) * gapPx) / children.length + 0.5;
    const avgRatio = 1 / children.length;
    const ratios = children.map((child) => {
        const match = child.style.width.match(/calc\(([\d.]+)%/);
        return match ? parseFloat(match[1]) / 100 : avgRatio;
    });
    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) || 1;
    const changes: Array<{ id: string; oldHTML: string }> = [];
    children.forEach((child, index) => {
        const id = child.getAttribute("data-node-id");
        if (!id) {
            return;
        }
        const oldHTML = child.outerHTML;
        const percent = Math.round((ratios[index] / totalRatio) * 100 * 10) / 10;
        child.style.width = `calc(${percent}% - ${gapShare}px)`;
        child.style.flex = "none";
        changes.push({ id, oldHTML });
    });
    return changes;
};

/**
 * 作用：刷新超级块手柄并把宽度变化写入事务操作。
 * 意图：让 DOM 变化、doOperations 与 undoOperations 同步，保证撤销时宽度恢复顺序正确。
 */
export const refreshSbAndPersistWidth = (
    sbElement: Element,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    if (!sbElement || !sbElement.parentElement) {
        return;
    }
    refreshSbResize(sbElement);
    for (const change of rebalanceSbWidth(sbElement)) {
        const targetElement = sbElement.querySelector(`[data-node-id="${change.id}"]`);
        if (!targetElement) {
            continue;
        }
        doOperations.push({ action: "update", id: change.id, data: targetElement.outerHTML });
        undoOperations.splice(0, 0, { action: "update", id: change.id, data: change.oldHTML });
    }
};

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
    if (isMobile) {
        openMobileFileById(protyle.app, targetId, action);
        return;
    }
    openFileById({
        app: protyle.app,
        id: targetId,
        action
    });
};

/**
 * 作用：跳转到当前块的父/子/兄弟块。
 * 意图：通过后端接口获取目标块 ID 后，桌面端用 openFileById 打开，移动端用 openMobileFileById。
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

/** 生成空块 HTML */
export const genEmptyBlock = (zwsp = true, wbr = true, string?: string) => {
    let html = "";
    if (zwsp) {
        html = Constants.ZWSP;
    }
    if (wbr) {
        html += "<wbr>";
    }
    if (string) {
        html += string;
    }
    return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeParagraph" class="p"><div contenteditable="true" spellcheck="${getSiyuanConfig().editor.spellcheck}">${html}</div><div contenteditable="false" class="protyle-attr">${Constants.ZWSP}</div></div>`;
};

/** 生成空块 DOM 元素 */
export const genEmptyElement = (zwsp = true, wbr = true, id?: string) => {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", id || Lute.NewNodeID());
    element.setAttribute("data-type", "NodeParagraph");
    element.classList.add("p");
    element.innerHTML = `<div contenteditable="true" spellcheck="${getSiyuanConfig().editor.spellcheck}">${zwsp ? Constants.ZWSP : ""}${wbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return element;
};

/** 生成标题元素 */
export const genHeadingElement = (headElement: Element, getHTML = false, addWbr = false) => {
    const html = `<div data-subtype="${headElement.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeHeading" class="${headElement.className}"><div contenteditable="true" spellcheck="false">${addWbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    if (getHTML) {
        return html;
    }
    const tempElement = document.createElement("template");
    tempElement.innerHTML = html;
    return tempElement.content.firstElementChild;
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
