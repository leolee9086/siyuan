import { setFold } from "../../menus/protyle";
import { hasClosestByClassName, hasClosestBlock } from "../util/hasClosest";
import { focusByWbr } from "../util/selection";
import { genListItemElement } from "./list";
import { transaction } from "./transaction";
import * as dayjs from "dayjs";
import { Constants } from "../../constants";
import { genEmptyBlock } from "../../block/util";


export const addSubList = (protyle: IProtyle, nodeElement: Element, range: Range) => {
    const parentItemElement = hasClosestByClassName(nodeElement, "li");
    if (!parentItemElement) {
        return;
    }
    //找到最后一个**子列表**,不是子列表项
    const lastSubItem = parentItemElement.querySelector(".list")?.lastElementChild?.previousElementSibling;
    if (!lastSubItem) {
        //在没有子列表的之后,创建一个子列表
        const subtype = parentItemElement.getAttribute("data-subtype") as "u" | "o" | "t" || "u";
        const newListElement = genListElement(subtype);
        const attrElements = parentItemElement.querySelectorAll('.protyle-attr')
        const lastAttrElement = attrElements[attrElements.length - 1]
        lastAttrElement && parentItemElement.insertBefore(newListElement, lastAttrElement);
        if (parentItemElement.getAttribute("fold") === "1") {
            setFold(protyle, parentItemElement, true);
        }

        // 获取前一个元素的ID，使用hasClosestBlock确保正确获取
        let previousId: string | undefined;
        const previousElement = newListElement.previousElementSibling;
        if (previousElement) {
            const previousBlock = hasClosestBlock(previousElement);
            if (previousBlock && typeof previousBlock !== "boolean") {
                previousId = previousBlock.getAttribute("data-node-id") || undefined;
            }
        }

        const insertOperation: IOperation = {
            action: "insert",
            id: newListElement.getAttribute("data-node-id")!,
            data: newListElement.outerHTML,
        };

        // 只有当 previousId 存在时才添加 previousID 属性
        if (previousId !== undefined) {
            insertOperation.previousID = previousId;
        }

        transaction(protyle, [insertOperation], [{
            action: "delete",
            id: newListElement.getAttribute("data-node-id")!,
        }]);

        // 聚焦到新创建的列表项
        const newListItem = newListElement.querySelector(".li") as HTMLElement;
        if (newListItem) {
            focusByWbr(newListItem, range);
        }
    } else {
        const newListElement = genListItemElement(lastSubItem, 0, true);
        const id = newListElement.getAttribute("data-node-id");
        lastSubItem.after(newListElement);

        if (lastSubItem.parentElement?.getAttribute("fold") === "1") {
            setFold(protyle, lastSubItem.parentElement, true);
        }
        if (parentItemElement.getAttribute("fold") === "1") {
            setFold(protyle, parentItemElement, true);
        }
        transaction(protyle, [{
            action: "insert",
            id: id!,
            data: newListElement.outerHTML,
            previousID: lastSubItem.getAttribute("data-node-id")!,
        }], [{
            action: "delete",
            id: id!,
        }]);
        focusByWbr(newListElement, range);
    }
};
/**
 * 生成列表元素，包含一个列表项
 * @param subtype 列表子类型: "u" 无序列表, "o" 有序列表, "t" 任务列表
 * @param referenceItem 参考的列表项，用于确定列表类型和标记
 * @returns 返回创建的列表元素
 */
const genListElement = (subtype: "u" | "o" | "t" = "u"): HTMLElement => {
    // 生成新的ID
    const listId = Lute.NewNodeID();
    const updatedTime = dayjs().format("YYYYMMDDHHmmss");

    // 确定标记符号
    let marker = "*";
    if (subtype === "o") {
        marker = "1.";
    } else if (subtype === "t") {
        marker = "*";
    }

    // 确定图标
    let icon = "Dot";
    if (subtype === "t") {
        icon = "Uncheck";
    }

    const element = document.createElement("div");
    element.innerHTML = `

    <div data-node-id="${listId}" data-type="NodeList" class="list" data-subtype="${subtype}">
        <div data-marker="${marker}" data-subtype="${subtype}" data-node-id="${Lute.NewNodeID()}" data-type="NodeListItem" class="li"
            updated="${updatedTime}">
            <div class="protyle-action" draggable="true"><svg>
                    <use xlink:href="#icon${icon}"></use>
                </svg></div>
           ${genEmptyBlock(false, true)}
            <div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>
        </div>
        <div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>
    </div>
    `
    return element.firstElementChild as HTMLElement;
};