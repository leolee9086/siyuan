import * as dayjs from "dayjs";
import {transaction} from "../../../wysiwyg/transaction/submit";
import { removeAttrViewColAnimation } from "../action";

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
    transaction(options.protyle, [{
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
    removeAttrViewColAnimation(options.blockElement, options.colId);
    options.blockElement.setAttribute("updated", newUpdated);
};
