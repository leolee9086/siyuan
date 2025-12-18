import {isInEmbedBlock} from "../util/hasClosest";
import {Constants} from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const genIconHTML = (element?: false | HTMLElement, actions = ["edit", "more"]) => {
    let enable = true;
    if (element) {
        const readonly = element.getAttribute("data-readonly");
        if (typeof readonly === "string") {
            enable = readonly === "false";
        } else {
            return '<div class="protyle-icons"></div>';
        }
    }
    if (actions.length === 3) {
        return `<div class="protyle-icons">
    <span aria-label="${siyuanI18n.refresh}" data-position="4north" class="ariaLabel protyle-icon protyle-icon--first protyle-action__reload"><svg><use xlink:href="#iconRefresh"></use></svg></span>
    <span aria-label="${siyuanI18n.edit}" data-position="4north" class="ariaLabel protyle-icon protyle-action__edit${enable ? "" : " fn__none"}"><svg><use xlink:href="#iconEdit"></use></svg></span>
    <span aria-label="${siyuanI18n.more}" data-position="4north" class="ariaLabel protyle-icon protyle-action__menu protyle-icon--last"><svg><use xlink:href="#iconMore"></use></svg></span>
</div>`;
    } else {
        return `<div class="protyle-icons">
    <span aria-label="${siyuanI18n.edit}" data-position="4north" class="ariaLabel protyle-icon protyle-icon--first protyle-action__edit${enable ? "" : " fn__none"}"><svg><use xlink:href="#iconEdit"></use></svg></span>
    <span aria-label="${siyuanI18n.more}" data-position="4north" class="ariaLabel protyle-icon protyle-action__menu protyle-icon--last${enable ? "" : " protyle-icon--first"}"><svg><use xlink:href="#iconMore"></use></svg></span>
</div>`;
    }
};

export const genRenderFrame = (renderElement: Element) => {
    if (renderElement.querySelector(".protyle-cursor")) {
        return;
    }
    const type = renderElement.getAttribute("data-type");
    if (type === "NodeBlockQueryEmbed") {
        renderElement.insertAdjacentHTML("afterbegin", `<div class="protyle-icons${isInEmbedBlock(renderElement) ? " fn__none" : ""}">
    <span aria-label="${siyuanI18n.refresh}" data-position="4north" class="ariaLabel protyle-icon protyle-action__reload protyle-icon--first"><svg class="fn__rotate"><use xlink:href="#iconRefresh"></use></svg></span>
    <span aria-label="${siyuanI18n.update} SQL" data-position="4north" class="ariaLabel protyle-icon protyle-action__edit"><svg><use xlink:href="#iconEdit"></use></svg></span>
    <span aria-label="${siyuanI18n.more}" data-position="4north" class="ariaLabel protyle-icon protyle-action__menu protyle-icon--last"><svg><use xlink:href="#iconMore"></use></svg></span>
</div><div class="protyle-cursor">${Constants.ZWSP}</div>`);
    } else if (type === "NodeMathBlock" || renderElement.getAttribute("data-subtype") === "math") {
        renderElement.firstElementChild.innerHTML = `<span></span><span class="protyle-cursor">${Constants.ZWSP}</span>`;
    }
};

export const processClonePHElement = (item: Element) => {
    item.querySelectorAll("protyle-html").forEach((phElement) => {
        phElement.setAttribute("data-content", Lute.UnEscapeHTMLStr(phElement.getAttribute("data-content")));
    });
    return item;
};
