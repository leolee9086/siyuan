export const addDragover = (element: HTMLElement) => {
    if (element.classList.contains("sb") ||
        element.classList.contains("li") ||
        element.classList.contains("list") ||
        element.classList.contains("bq")) {
        element.classList.add("dragover");
    }
};

// https://github.com/siyuan-note/siyuan/issues/12651
export const clearDragoverElement = (element: Element) => {
    if (element) {
        element.classList.remove("dragover__top", "dragover__bottom", "dragover__left", "dragover__right", "dragover");
        // element = undefined; // Reference update doesn't work this way outside, but the class removal is what matters. 
        // The caller should set their variable to undefined.
    }
};
