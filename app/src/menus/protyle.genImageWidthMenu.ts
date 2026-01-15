import * as dayjs from "dayjs";
import { img3115 } from "../boot/compatibleVersion";
import { focusBlock } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";


export const genImageWidthMenu = (label: string, imgElement: HTMLElement, protyle: IProtyle, id: string, nodeElement: HTMLElement, html: string) => {
    return {
        id: label === siyuanI18n.default ? "default" : "width_" + label,
        iconHTML: "",
        label,
        click() {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            img3115(imgElement.parentElement.parentElement);
            imgElement.parentElement.style.width = label === siyuanI18n.default ? "" : `calc(${label} - 8px)`;
            imgElement.style.height = "";
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
            focusBlock(nodeElement);
        }
    };
};
