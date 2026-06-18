/** 用途：编辑器选区聚焦。使用范围：插入块后恢复光标位置。解耦评估：通过 ./imports 转发。 */
import { focusByWbr } from "./imports";
/** 用途：编辑器选区范围获取。使用范围：插入块后获取选区。解耦评估：通过 ./imports 转发。 */
import { getEditorRange } from "./imports";
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
/** 用途：国际化文案。使用范围：块类型名称。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：获取 SiYuan 配置。使用范围：读取拼写检查配置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanConfig } from "./imports";
/** 用途：移动端判断。使用范围：区分移动/桌面端。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：获取插入目标块。使用范围：插入空块定位。解耦评估：同目录模块直接导入。 */
import { getInsertTargetBlock } from "./util.getInsertTargetBlock";
/** 用途：创建新块元素。使用范围：插入空块创建元素。解耦评估：同目录模块直接导入。 */
import { createNewBlockElement } from "./util.createNewBlockElement";
/** 创建超级块元素 */
export const genSBElement = async (layout: string, id?: string, attrHTML?: string) => {
    const sbElement = document.createElement("div");
    sbElement.setAttribute("data-node-id", id || Lute.NewNodeID());
    sbElement.setAttribute("data-type", "NodeSuperBlock");
    sbElement.setAttribute("class", "sb");
    sbElement.setAttribute("data-sb-layout", layout);
    sbElement.innerHTML = attrHTML || `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return sbElement;
};

/** 处理块兄弟 ID 响应 */
function handleSiblingResponse(response: IWebSocketData, protyle: IProtyle, type: string) {
    const targetId = response.data[type];
    if (!targetId) {
        return;
    }
    const action = targetId !== protyle.block.rootID && protyle.block.showAll ? [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS];
    if (isMobile) {
        openMobileFileById(protyle.app, targetId, action);
        return;
    }
    openFileById({
        app: protyle.app,
        id: targetId,
        action,
    });
}

/** 跳转到父/子块 */
export const jumpToParent = async (protyle: IProtyle, nodeElement: Element, type: "parent" | "next" | "previous") => {
    fetchPost("/api/block/getBlockSiblingID", { id: nodeElement.getAttribute("data-node-id") }, (response) => {
        handleSiblingResponse(response, protyle, type);
    });
};

/** 插入空块 */
export const insertEmptyBlock = async (protyle: IProtyle, position: InsertPosition, id?: string) => {
    const blockElement = getInsertTargetBlock(protyle, id, position);
    if (!blockElement) {
        return;
    }
    protyle.observerLoad?.disconnect();
    const { newElement, orderIndex } = createNewBlockElement(blockElement, position);
    const parentOldHTML = blockElement.parentElement.outerHTML;
    const newId = newElement.getAttribute("data-node-id");
    blockElement.insertAdjacentElement(position, newElement);

    const parentElement = newElement.parentElement;
    let listHandled = false;
    // 有序列表项需要更新编号
    if (parentElement && blockElement.getAttribute("data-type") === "NodeListItem" && blockElement.getAttribute("data-subtype") === "o" &&
        !parentElement.classList.contains("protyle-wysiwyg")) {
        updateListOrder(parentElement, orderIndex);
        updateTransaction(protyle, parentElement.getAttribute("data-node-id") || "", parentElement.outerHTML, parentOldHTML);
        listHandled = true;
    }

    if (!listHandled) {
        const doOperations: IOperation[] = [{
            action: "insert",
            data: newElement.outerHTML,
            id: newId || "",
            nextID: position === "beforebegin" ? (blockElement.getAttribute("data-node-id") || undefined) : undefined,
            previousID: position !== "beforebegin" ? (blockElement.getAttribute("data-node-id") || undefined) : undefined,
        }];
        transaction(protyle, doOperations, [{
            action: "delete",
            id: newId || "",
        }]);
    }
    const prev = blockElement.previousElementSibling;
    const next = blockElement.nextElementSibling;
    // 在列布局超级块中插入时自动合并
    if (prev && next && blockElement.parentElement?.classList.contains("sb") &&
        blockElement.parentElement.getAttribute("data-sb-layout") === "col") {
        turnsIntoOneTransaction({
            protyle,
            selectsElement: position === "afterend" ? [blockElement, next] : [prev, blockElement],
            type: "BlocksMergeSuperBlock",
            level: "row",
            unfocus: true,
        });
    }
    // 插入后恢复光标位置
    if (protyle.wysiwyg?.element) {
        const range = getEditorRange(protyle.wysiwyg.element);
        focusByWbr(protyle.wysiwyg.element, range);
    }
    scrollCenter(protyle);
};

/** 生成空块 HTML */
export const genEmptyBlock = async (zwsp = true, wbr = true, string?: string) => {
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
export const genEmptyElement = async (zwsp = true, wbr = true, id?: string) => {
    const element = document.createElement("div");
    element.setAttribute("data-node-id", id || Lute.NewNodeID());
    element.setAttribute("data-type", "NodeParagraph");
    element.classList.add("p");
    element.innerHTML = `<div contenteditable="true" spellcheck="${getSiyuanConfig().editor.spellcheck}">${zwsp ? Constants.ZWSP : ""}${wbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return element;
};

/** 生成标题元素 */
export const genHeadingElement = async (headElement: Element, getHTML = false, addWbr = false) => {
    const html = `<div data-subtype="${headElement.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeHeading" class="${headElement.className}"><div contenteditable="true" spellcheck="false">${addWbr ? "<wbr>" : ""}</div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    if (getHTML) {
        return html;
    }
    const tempElement = document.createElement("template");
    tempElement.innerHTML = html;
    return tempElement.content.firstElementChild;
};

/** 根据块类型获取语言名称 */
export const getLangByType = async (type: string) => {
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
