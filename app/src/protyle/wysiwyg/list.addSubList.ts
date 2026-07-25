import { setFold } from "../util/blockFold";
import { hasClosestByClassName, hasClosestBlock } from "../util/hasClosest";
import { focusByWbr } from "../util/selection";
import { genListItemElement } from "./list";
import { transaction } from "./transaction";
import * as dayjs from "dayjs";
import { Constants } from "../../constants";
import { genEmptyBlock } from "../../block/element.factory";

/**
 * 在指定列表项下添加子列表（或追加同级列表项）。
 *
 * 整体逻辑：
 * 1. 如果当前列表项还没有子列表，则创建一个新的子列表（包含一个初始列表项），
 *    并记录前驱元素 ID 以正确拼接到块结构树中。
 * 2. 如果当前列表项已有子列表，则在最后一个子列表项的后面追加一个新的同级列表项。
 *
 * @param protyle     - 编辑器实例，用于提交事务
 * @param nodeElement - 触发操作的 DOM 元素（如按钮、菜单项）
 * @param range       - 当前选区范围，用于操作后焦点定位
 */
export const addSubList = (protyle: IProtyle, nodeElement: Element, range: Range) => {
    // 向上查找最近的 <li> 列表项元素
    const parentItemElement = hasClosestByClassName(nodeElement, "li");
    if (!parentItemElement) {
        return;
    }

    // 找到当前列表项下的最后一个子列表中的倒数第二个子项（即最后一个实际列表项）
    const lastSubItem = parentItemElement.querySelector(".list")?.lastElementChild?.previousElementSibling;
    if (!lastSubItem) {
        /* ============ 情况一：没有子列表 → 创建一个新的子列表 ============ */

        // 从父列表项继承列表子类型（无序 u / 有序 o / 任务 t），默认为无序
        const subtype = parentItemElement.getAttribute("data-subtype") as "u" | "o" | "t" || "u";
        const newListElement = genListElement(subtype);

        // 将新子列表插入到父列表项的 .protyle-attr 之前（即最末尾的属性占位前）
        const attrElements = parentItemElement.querySelectorAll(".protyle-attr");
        const lastAttrElement = attrElements[attrElements.length - 1];
        lastAttrElement && parentItemElement.insertBefore(newListElement, lastAttrElement);

        // 如果父列表项处于折叠状态，更新折叠表现
        if (parentItemElement.getAttribute("fold") === "1") {
            setFold(protyle, parentItemElement, true);
        }

        // 获取新子列表的前一个兄弟块 ID，用于操作事务中的 previousID
        let previousId: string | undefined;
        const previousElement = newListElement.previousElementSibling;
        if (previousElement) {
            const previousBlock = hasClosestBlock(previousElement);
            if (previousBlock && typeof previousBlock !== "boolean") {
                previousId = previousBlock.getAttribute("data-node-id") || undefined;
            }
        }

        // 构造插入操作：将新子列表插入到文档中
        const insertOperation: IOperation = {
            action: "insert",
            id: newListElement.getAttribute("data-node-id")!,
            data: newListElement.outerHTML,
        };

        // 仅当有前驱 ID 时才设置 previousID，确保正确的块顺序
        if (previousId !== undefined) {
            insertOperation.previousID = previousId;
        }

        // 提交事务：先插入新块，再执行删除操作（撤销态预留）
        transaction(protyle, [insertOperation], [{
            action: "delete",
            id: newListElement.getAttribute("data-node-id")!,
        }]);

        // 将焦点移动到新创建的子列表项中
        const newListItem = newListElement.querySelector(".li") as HTMLElement;
        if (newListItem) {
            focusByWbr(newListItem, range);
        }
    } else {
        /* ============ 情况二：已有子列表 → 追加一个新的同级列表项 ============ */

        // 基于最后一个子列表项生成新的列表项（标签类型、样式保持一致）
        const newListElement = genListItemElement(lastSubItem, 0, true);
        const id = newListElement.getAttribute("data-node-id");
        lastSubItem.after(newListElement);

        // 如果子列表或其父列表项处于折叠状态，更新折叠表现
        if (lastSubItem.parentElement?.getAttribute("fold") === "1") {
            setFold(protyle, lastSubItem.parentElement, true);
        }
        if (parentItemElement.getAttribute("fold") === "1") {
            setFold(protyle, parentItemElement, true);
        }

        // 提交事务：在最后一个子列表项之后插入新项，并设置 previousID
        transaction(protyle, [{
            action: "insert",
            id: id!,
            data: newListElement.outerHTML,
            previousID: lastSubItem.getAttribute("data-node-id")!,
        }], [{
            action: "delete",
            id: id!,
        }]);

        // 将焦点移动到新追加的列表项中
        focusByWbr(newListElement, range);
    }
};
/**
 * 生成一个包含单个列表项的新列表 DOM 元素。
 *
 * 根据子类型生成对应的 HTML 结构（含列表容器、列表项、拖拽手柄图标、空块占位及属性占位）。
 *
 * @param subtype 列表子类型：
 *   - "u"：无序列表（标记 *，图标 Dot）
 *   - "o"：有序列表（标记 1.，图标 Dot）
 *   - "t"：任务列表（标记 *，图标 Uncheck）
 * @returns 返回创建的列表 <div> 元素（data-type="NodeList"）
 */
const genListElement = (subtype: "u" | "o" | "t" = "u"): HTMLElement => {
    // 为新列表和列表项生成唯一 ID
    const listId = Lute.NewNodeID();
    const updatedTime = dayjs().format("YYYYMMDDHHmmss");

    // 根据子类型确定列表项前的标记符号
    let marker = "*";
    if (subtype === "o") {
        marker = "1.";
    } else if (subtype === "t") {
        marker = "*";
    }

    // 根据子类型确定折叠/拖拽区域显示的图标
    let icon = "Dot";
    if (subtype === "t") {
        icon = "Uncheck";
    }

    // 构建完整 DOM 结构字符串
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
    `;
    return element.firstElementChild as HTMLElement;
};
