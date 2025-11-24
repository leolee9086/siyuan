import { setPosition } from "../util/setPosition";
import { clearRectElement, setRectElement } from "./anno";

export const showToolbar = (element: HTMLElement, range: Range, target?: HTMLElement) => {
    if (target) {
        // 阻止 popover
        target.setAttribute("prevent-popover", "true");
        setTimeout(() => {
            target.removeAttribute("prevent-popover");
        }, 620);
    }

    const utilElement = element.querySelector(".pdf__util") as HTMLElement;
    utilElement.classList.remove("fn__none");

    if (range) {
        utilElement.classList.add("pdf__util--hide");
        const rects = range.getClientRects();
        const rect = rects[rects.length - 1];
        setPosition(utilElement, rect!.left, rect!.bottom);
        clearRectElement()
        return;
    }
    if (target) {
        setRectElement(target);
        utilElement.classList.remove("pdf__util--hide");
        const firstRectElement = target.firstElementChild;
        if (firstRectElement) {
            const targetRect = firstRectElement.getBoundingClientRect();
            setPosition(utilElement, targetRect.left, targetRect.top + targetRect.height + 4);
        }
    }
};
