import { hasClosestByAttribute } from "../../protyle/util/hasClosest";


export const hlPDFRect = (element: HTMLElement, id: string) => {
    const rectElements = element.querySelectorAll(`.pdf__rect[data-node-id="${id}"]`);
    for (const item of rectElements) {
        if (!item || !item.firstElementChild) {
            continue;
        }
        item.classList.add("pdf__rect--hl");
        setTimeout(() => {
            item.classList.remove("pdf__rect--hl");
        }, 1500);

        const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
        if (!scrollElement) {
            continue;
        }
        const currentRect = item.firstElementChild.getBoundingClientRect();
        const scrollRect = scrollElement.getBoundingClientRect();
        if (currentRect.top < scrollRect.top) {
            scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                (scrollRect.height - currentRect.height) / 2;
            continue;
        }
        if (currentRect.bottom > scrollRect.bottom) {
            scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                (scrollRect.height - currentRect.height) / 2;
        }
    }
};
