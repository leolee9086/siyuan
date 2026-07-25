import { hasClosestByAttribute } from "../../protyle/util/hasClosest";
import type { AppFacade } from "../../app/AppFacade.types";
import { handleBazaarInstallClick } from "./bazaarInstallHandlers";
import { handleBazaarNavClick, handleBazaarUIInteraction } from "./bazaarUIHandlers";
import { IBazaar, IBazaarDataObj } from "./types";

export function handleBazaarClick(event: MouseEvent, bazaar: IBazaar<AppFacade>, app: AppFacade) {
    let target = event.target as HTMLElement;
    const dataElement = hasClosestByAttribute(target, "data-obj", null);
    let dataObj: IBazaarDataObj | undefined;
    const objStr = dataElement && dataElement.getAttribute("data-obj");
    if (objStr) {
        dataObj = JSON.parse(objStr);
    }
    while (target && bazaar.element && !target.isEqualNode(bazaar.element)) {
        const type = target.getAttribute("data-type");
        if (target.tagName === "A") {
            break;
        }
        if (type && dataObj && handleBazaarNavClick(type, target, dataObj, bazaar, app, event)) {
            break;
        }
        if (type && dataObj && handleBazaarInstallClick(type, target, dataObj, bazaar, app, event)) {
            break;
        }
        if (handleBazaarUIInteraction(target, type, bazaar, app, event)) {
            break;
        }
        target = target.parentElement as HTMLElement;
    }
}
