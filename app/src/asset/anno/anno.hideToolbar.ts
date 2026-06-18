
/** 隐藏 PDF 工具栏 */
export const hideToolbar = async (element: HTMLElement) => {
    const toolbarElement = element.querySelector(".pdf__util");
    toolbarElement?.classList.add("fn__none");
};
