import {hasClosestByClassName} from "../../../util/hasClosest";
import {avContextmenu} from "../action";
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

export const openGalleryItemMenu = (options: {
    target: HTMLElement,
    protyle: IProtyle,
    position: {
        x:number,
        y:number
    }
}) => {
    const cardElement = hasClosestByClassName(options.target, "av__gallery-item");
    if (!cardElement) {
        return;
    }
    avContextmenu(options.protyle, cardElement, options.position);
};

export const editGalleryItem = (target: Element) => {
    const itemElement = hasClosestByClassName(target, "av__gallery-item");
    if (itemElement) {
        const fieldsElement = itemElement.querySelector(".av__gallery-fields");
        if (fieldsElement) {
            target.setAttribute("aria-label", siyuanI18n[fieldsElement.classList.contains("av__gallery-fields--edit") ? "displayEmptyFields" : "hideEmptyFields"]);
            fieldsElement.classList.toggle("av__gallery-fields--edit");
        }
    }
};
