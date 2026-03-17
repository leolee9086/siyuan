
export const hideToolbar = (element: HTMLElement) => {
    const toolbarElement = element.querySelector(".pdf__util");
    toolbarElement?.classList.add("fn__none");
};
