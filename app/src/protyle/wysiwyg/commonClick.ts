import { hasClosestByClassName } from "../util/hasClosest";
import { openFileAttr } from "../../menus/commonMenuItem.openFileAttr";
import { openAttr } from "../../menus/commonMenuItem";
/// #if !MOBILE
import { openGlobalSearch } from "../../search/util";
/// #endif
import { isMobile } from "../../util/functions";
import { isOnlyMeta } from "../util/compatibility";

const handleCommonAttrClick = (
    event: MouseEvent & { target: HTMLElement },
    protyle: IProtyle,
    type: string,
    element: HTMLElement,
    data?: IObject,
    searchText?: string
) => {
    event.stopPropagation();
    const isM = isMobile();
    if (searchText && !isM && isOnlyMeta(event)) {
        /// #if !MOBILE
        openGlobalSearch(protyle.app, searchText, true);
        /// #endif
        return true;
    }

    if (data) {
        openFileAttr(data, type, protyle);
        return true;
    }

    if (element.parentElement?.parentElement) {
        openAttr(element.parentElement.parentElement, type, protyle);
    }
    return true;
};

export const commonClick = (event: MouseEvent & {
    target: HTMLElement
}, protyle: IProtyle, data?: IObject) => {
    let element = hasClosestByClassName(event.target, "protyle-attr--bookmark");
    if (element) {
        return handleCommonAttrClick(event, protyle, "bookmark", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--name");
    if (element) {
        return handleCommonAttrClick(event, protyle, "name", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--av");
    if (element) {
        return handleCommonAttrClick(event, protyle, "av", element, data);
    }

    element = hasClosestByClassName(event.target, "protyle-attr--alias");
    if (element) {
        return handleCommonAttrClick(event, protyle, "alias", element, data, element.textContent.trim());
    }

    element = hasClosestByClassName(event.target, "protyle-attr--memo");
    if (element) {
        return handleCommonAttrClick(event, protyle, "memo", element, data, (element.getAttribute("aria-label") || "").trim());
    }
};
