import { hasClosestByAttribute } from "../protyle/util/hasClosest";


export const hlPDFRect = (element: HTMLElement, id: string) => {
    element.querySelectorAll(`.pdf__rect[data-node-id="${id}"]`).forEach(item => {
        if (!item || !item.firstElementChild) {
            return;
        }
        item.classList.add("pdf__rect--hl");
        setTimeout(() => {
            item.classList.remove("pdf__rect--hl");
        }, 1500);

        const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
        if (!scrollElement) {
            return;
        }
        const currentRect = item.firstElementChild.getBoundingClientRect();
        const scrollRect = scrollElement.getBoundingClientRect();
        if (currentRect.top < scrollRect.top) {
            scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                (scrollRect.height - currentRect.height) / 2;
            return;
        }
        if (currentRect.bottom > scrollRect.bottom) {
            scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                (scrollRect.height - currentRect.height) / 2;
        }
    });
};
