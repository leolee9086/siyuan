import {addClearButton} from "../../../util/DOM/addClearButton";
import {focusBlock} from "../../util/selection";
import {electronUndo} from "../../undo";
import {activeBlur} from "../../../mobile/keyboard/activeBlur";
import {isMobile} from "../../../platform";
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

const collapseAvSearch = (searchInputElement: HTMLElement, viewsElement: HTMLElement) => {
    viewsElement.classList.remove("av__views--show");
    searchInputElement.style.width = "0";
    searchInputElement.style.paddingLeft = "0";
    searchInputElement.style.marginRight = "0";
};

export const bindAvSearch = (options: {
    blockElement: HTMLElement,
    query?: string,
    isSearching?: boolean,
    onChange: () => void,
}) => {
    const viewsElement = options.blockElement.querySelector(".av__views") as HTMLElement;
    const searchInputElement = options.blockElement.querySelector('[data-type="av-search"]') as HTMLElement;
    searchInputElement.textContent = options.query || "";
    if (options.isSearching) {
        searchInputElement.focus();
    }
    searchInputElement.addEventListener("compositionstart", (event: KeyboardEvent) => {
        event.stopPropagation();
    });
    searchInputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        electronUndo(event);
    });
    const searchInputChange = (event: Event) => {
        event.stopPropagation();
        if ((event as KeyboardEvent).isComposing) {
            return;
        }
        if (searchInputElement.textContent || document.activeElement === searchInputElement) {
            viewsElement.classList.add("av__views--show");
        } else {
            viewsElement.classList.remove("av__views--show");
        }
        options.onChange();
    };
    searchInputElement.addEventListener("input", searchInputChange);
    // 剪切不会触发 input
    searchInputElement.addEventListener("cut", (event) => {
        setTimeout(() => {
            searchInputChange(event);
        });
    });
    searchInputElement.addEventListener("compositionend", () => {
        options.onChange();
    });
    searchInputElement.addEventListener("blur", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        if (!searchInputElement.textContent) {
            collapseAvSearch(searchInputElement, viewsElement);
        }
    });
    addClearButton({
        inputElement: searchInputElement,
        right: 0,
        width: "1em",
        height: searchInputElement.clientHeight,
        clearAriaLabel: siyuanI18n.clear,
        clearCB() {
            collapseAvSearch(searchInputElement, viewsElement);
            focusBlock(options.blockElement);
            options.onChange();
            if (isMobile) {
                activeBlur();
            }
        }
    });
};
