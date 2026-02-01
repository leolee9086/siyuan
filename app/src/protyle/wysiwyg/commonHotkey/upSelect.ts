import { countBlockWord } from "../../../layout/status";
import { hideElements } from "../../ui/hideElements";
import { handleSelectUpEmpty } from "./commonHotkeySelect";


export const upSelect = (options: {
    protyle: IProtyle;
    event: KeyboardEvent;
    nodeElement: HTMLElement;
    editorElement: HTMLElement;
    range: Range;
    cb: (selectElements: NodeListOf<Element>) => void;
}) => {
    if (!options.protyle.wysiwyg) {
        return;
    }
    const selectElements = options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
    if (selectElements.length > 0) {
        options.event.stopPropagation();
        options.event.preventDefault();
    }

    if (selectElements.length === 0 && handleSelectUpEmpty(options)) {
        return;
    }
    options.range.collapse(true);
    hideElements(["toolbar"], options.protyle);
    if (selectElements.length === 0) {
        options.nodeElement.classList.add("protyle-wysiwyg--select");
    }

    if (selectElements.length > 0) {
        options.cb(selectElements);
    }
    const ids: string[] = [];
    for (const item of options.protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select")) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    countBlockWord(ids, options.protyle.block.rootID);
    options.event.stopPropagation();
    options.event.preventDefault();
};
