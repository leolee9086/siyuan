import { getAllModels } from "../../layout/getAll";
import { hasClosestByAttribute, hasClosestByClassName, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { hideAllElements } from "../../protyle/ui/hideElements";
import { isWindow } from "../../util/platform/functions";
import { writeText } from "../../protyle/util/compatibility";
import { showMessage } from "../../dialog/message";
import { cancelDrag } from "./dragover";
import { isMobile } from "../../platform";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { getSiyuanLayout } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { nbsp2space, removeZWJ } from "../../protyle/util/normalizeText";
import { getDockByType } from "../../layout/tabUtil";
export const globalClickHideMenu = (element: HTMLElement) => {
    const menu = getSiyuanGlobalMenusMenu();
    if (!menu) {
        return;
    }
    if (menu.element.contains(element) || hasClosestByAttribute(element, "data-menu", "true")) {
        return;
    }

    if (getSelection().rangeCount > 0 &&
        menu.element.contains(getSelection().getRangeAt(0).startContainer) &&
        menu.element.contains(document.activeElement)) {
        // https://ld246.com/article/1654567749834/comment/1654589171218#comments
        return;
    }
    menu.remove();
};

const handleProtyleClick = (event: MouseEvent & { target: HTMLElement }) => {
    const protyleElement = hasClosestByClassName(event.target, "protyle", true);
    if (!protyleElement) {
        return;
    }
    const wysiwygElement = protyleElement.querySelector(".protyle-wysiwyg");
    if (!wysiwygElement) {
        return;
    }
    const isReadonly = wysiwygElement.getAttribute("data-readonly") === "true";
    if (isReadonly || !wysiwygElement.contains(event.target)) {
        wysiwygElement.dispatchEvent(new Event("focusin"));
    }
};

const handleHiddenProtyleFont = (event: MouseEvent & { target: HTMLElement }) => {
    if (!hasTopClosestByClassName(event.target, "protyle-util") &&
        !hasTopClosestByClassName(event.target, "protyle-toolbar")) {
        const protyleFonts = document.querySelectorAll(".protyle-font");
        for (const item of protyleFonts) {
            if (item.parentElement) {
                item.parentElement.classList.add("fn__none");
            }
        }
    }
};

const handleCopyClick = (event: MouseEvent & { target: HTMLElement }) => {
    const copyElement = hasTopClosestByClassName(event.target, "protyle-action__copy");
    if (copyElement && copyElement.parentElement && copyElement.parentElement.nextElementSibling) {
        const text = removeZWJ(nbsp2space(copyElement.parentElement.nextElementSibling.textContent?.replace(/\n$/, "") || ""));
        writeText(text);
        showMessage(siyuanI18n.copied, 2000);
        event.preventDefault();
        return true;
    }
    return false;
};

const handleDockClick = (event: MouseEvent & { target: HTMLElement }) => {
    if (isMobile) {
        return;
    }
    // dock float 时，点击空白处，隐藏 dock。场景：文档树上重命名后
    if (!isWindow() && getSiyuanLayout().leftDock &&
        !hasClosestByClassName(event.target, "b3-dialog--open", true) &&
        !hasClosestByClassName(event.target, "b3-menu") &&
        !hasClosestByClassName(event.target, "block__popover") &&
        !hasClosestByClassName(event.target, "protyle-hint--agent-overlay") &&
        !hasClosestByClassName(event.target, "dock") &&
        !hasClosestByClassName(event.target, "layout--float", true)
    ) {
        const layout = getSiyuanLayout();
        layout.bottomDock?.hideDock();
        layout.leftDock?.hideDock();
        layout.rightDock?.hideDock();
    }
    // Dock item click
    const dockItemElement = hasClosestByClassName(event.target as HTMLElement, "dock__item");
    if (dockItemElement) {
        const type = dockItemElement.getAttribute("data-type") as TDock;
        if (type) {
            getDockByType(type).toggleModel(type, false, true);
        }
    }
};

const handlePDFClick = (event: MouseEvent & { target: HTMLElement }) => {
    if (isMobile) {
        return;
    }
    if (!hasClosestByClassName(event.target, "pdf__outer")) {
        hideAllElements(["pdfutil"]);
    }

    // 点击空白，pdf 搜索、更多消失
    if (hasClosestByAttribute(event.target, "id", "secondaryToolbarToggleButton") ||
        hasClosestByAttribute(event.target, "id", "viewFindButton") ||
        hasClosestByAttribute(event.target, "id", "findbar")) {
        return;
    }
    let currentPDFViewerObject;
    for (const item of getAllModels().asset) {
        if (item.pdfObject &&
            !item.pdfObject.appConfig.appContainer.classList.contains("fn__none")) {
            currentPDFViewerObject = item.pdfObject;
            break;
        }
    }
    if (!currentPDFViewerObject) {
        return;
    }
    if (currentPDFViewerObject.secondaryToolbar.isOpen) {
        currentPDFViewerObject.secondaryToolbar.close();
    }
    if (
        !currentPDFViewerObject.supportsIntegratedFind &&
        currentPDFViewerObject.findBar.opened
    ) {
        currentPDFViewerObject.findBar.close();
    }
};

export const globalClick = (event: MouseEvent & { target: HTMLElement }) => {
    cancelDrag();

    globalClickHideMenu(event.target);

    handleProtyleClick(event);

    handleHiddenProtyleFont(event);

    if (handleCopyClick(event)) {
        return;
    }

    handleDockClick(event);
    handlePDFClick(event);
};
