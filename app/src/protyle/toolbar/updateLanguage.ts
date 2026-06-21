import { Constants } from "../../constants";
import { focusByRange } from "../util/selection";
import { hasClosestBlock } from "../util/hasClosest";
import { highlightRender } from "../render/highlightRender";
import { getContenteditableElement } from "../wysiwyg/getBlock";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { transaction } from "../wysiwyg/transaction";
import { setStorageVal } from "../util/compatibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import * as dayjs from "dayjs";

export function updateLanguage(
    protyle: IProtyle,
    languageElements: HTMLElement[],
    selectedLang: string,
    subElement: HTMLElement,
    range: Range
) {
    const currentLang = selectedLang === siyuanI18n.clear ? "" : selectedLang;
    if (protyle.app && protyle.app.plugins) {
        protyle.app.plugins.forEach((plugin: any) => {
            plugin.eventBus.emit("code-language-change", {
                language: currentLang,
                languageElements,
                protyle: protyle
            });
        });
    }
    if (!Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(currentLang)) {
        window.siyuan.storage[Constants.LOCAL_CODELANG] = currentLang;
        setStorageVal(Constants.LOCAL_CODELANG, window.siyuan.storage[Constants.LOCAL_CODELANG]);
    }
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    languageElements.forEach(item => {
        const nodeElement = hasClosestBlock(item);
        if (nodeElement) {
            const id = nodeElement.getAttribute("data-node-id");
            undoOperations.push({
                id,
                data: nodeElement.outerHTML,
                action: "update"
            });
            item.textContent = selectedLang === siyuanI18n.clear ? "" : selectedLang;
            const editElement = getContenteditableElement(nodeElement);
            if (Constants.SIYUAN_RENDER_CODE_LANGUAGES.includes(currentLang)) {
                nodeElement.dataset.content = editElement.textContent.trim();
                nodeElement.dataset.subtype = currentLang;
                nodeElement.className = "render-node";
                nodeElement.innerHTML = `<div spin="1"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
                contentRendererRegistry.renderElement(nodeElement);
            } else {
                (editElement as HTMLElement).textContent = editElement.textContent;
                editElement.parentElement.removeAttribute("data-render");
                highlightRender(nodeElement);
            }
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            nodeElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
            doOperations.push({
                id,
                data: nodeElement.outerHTML,
                action: "update"
            });
        }
    });
    transaction(protyle, doOperations, undoOperations);
    subElement.classList.add("fn__none");
    focusByRange(range);
}
