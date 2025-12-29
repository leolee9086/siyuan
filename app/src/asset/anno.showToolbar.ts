import { setPosition } from "../util/setPosition";
import { clearRectElement, setRectElement } from "./anno";

const handleRange = (utilElement: HTMLElement, range: Range) => {
    utilElement.classList.add("pdf__util--hide");
    const rects = range.getClientRects();
    const rect = rects.item(rects.length - 1);
    if (rect) {
        setPosition(utilElement, rect.left, rect.bottom);
    }
    clearRectElement();
};

export const showToolbar = (element: HTMLElement, range?: Range, target?: HTMLElement) => {
    if (target) {
        // 阻止 popover
        target.setAttribute("prevent-popover", "true");
        setTimeout(() => {
            target.removeAttribute("prevent-popover");
        }, 620);
    }

    const utilElement = element.querySelector(".pdf__util");
    if (!(utilElement instanceof HTMLElement)) {
        return;
    }
    utilElement.classList.remove("fn__none");

    if (range) {
        handleRange(utilElement, range);
        return;
    }
    if (!target) {
        return;
    }
    setRectElement(target);
    utilElement.classList.remove("pdf__util--hide");
    const firstRectElement = target.firstElementChild;
    if (firstRectElement) {
        const targetRect = firstRectElement.getBoundingClientRect();
        setPosition(utilElement, targetRect.left, targetRect.top + targetRect.height + 4);
    }
};
