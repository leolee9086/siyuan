import { setFold } from "../../menus/protyle";
import { hasClosestByClassName } from "../util/hasClosest";
import { focusByWbr } from "../util/selection";
import { genListItemElement } from "./list";
import { transaction } from "./transaction";


export const addSubList = (protyle: IProtyle, nodeElement: Element, range: Range) => {
    const parentItemElement = hasClosestByClassName(nodeElement, "li");
    if (!parentItemElement) {
        return;
    }
    //找到最后一个**子列表**,不是子列表项
    const lastSubItem = parentItemElement.querySelector(".list")?.lastElementChild.previousElementSibling;
    if (!lastSubItem) {
        return;
    }
    const newListElement = genListItemElement(lastSubItem, 0, true);
    const id = newListElement.getAttribute("data-node-id");
    lastSubItem.after(newListElement);

    if (lastSubItem.parentElement.getAttribute("fold") === "1") {
        setFold(protyle, lastSubItem.parentElement, true);
    }
    if (parentItemElement.getAttribute("fold") === "1") {
        setFold(protyle, parentItemElement, true);
    }
    transaction(protyle, [{
        action: "insert",
        id,
        data: newListElement.outerHTML,
        previousID: lastSubItem.getAttribute("data-node-id"),
    }], [{
        action: "delete",
        id,
    }]);
    focusByWbr(newListElement, range);
};
