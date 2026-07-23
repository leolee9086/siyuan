/** 根据当前设置、子项数量和发布权限编辑状态刷新单个文档动作区域。 */
export const updateDocActionElement = (treeElement: HTMLElement, liElement: HTMLElement): void => {
    const iconElement = liElement.querySelector<HTMLElement>(".b3-list-item__icon");
    if (!iconElement) {
        return;
    }
    const isFile = liElement.dataset.type === "navigation-file";
    const isBoxDoc = liElement.dataset.type === "navigation-root" && Boolean(liElement.dataset.nodeId);
    const isDocument = isFile || isBoxDoc;
    const hasChildren = isDocument && Number(liElement.dataset.count) > 0;
    const iconUsesDocAction = window.siyuan.config.fileTree.docIconClickExpand && isDocument;
    const editingPublishAccess = treeElement.classList.contains("file-tree__publish-access--active");
    iconElement.setAttribute("aria-label", iconUsesDocAction ?
        (hasChildren ? window.siyuan.languages.docIconClickExpand : window.siyuan.languages.openDocument) :
        window.siyuan.languages.changeIcon);
    liElement.classList.toggle("file-tree__item--icon-expand", hasChildren && iconUsesDocAction && !editingPublishAccess);
    liElement.classList.toggle("file-tree__item--icon-open", isDocument && !hasChildren && iconUsesDocAction &&
        !editingPublishAccess);
    liElement.classList.toggle("file-tree__item--title-expand", hasChildren &&
        window.siyuan.config.fileTree.parentDocClickExpand);
};

/** 更新子项数量、展开控件和对应动作状态。 */
export const updateSubFileCount = (treeElement: HTMLElement, liElement: HTMLElement, subFileCount: number): void => {
    liElement.dataset.count = subFileCount.toString();
    if (subFileCount === 0) {
        liElement.querySelector(".b3-list-item__toggle")?.classList.add("fn__hidden");
        liElement.querySelector(".b3-list-item__arrow")?.classList.remove("b3-list-item__arrow--open");
        if (liElement.nextElementSibling?.tagName === "UL") {
            liElement.nextElementSibling.remove();
        }
    }
    if (subFileCount > 0) {
        liElement.querySelector(".b3-list-item__toggle")?.classList.remove("fn__hidden");
    }
    updateDocActionElement(treeElement, liElement);
};

/** 刷新文件树内所有普通文档和顶层笔记本文档的动作投影。 */
export const updateAllDocActions = (treeElement: HTMLElement): void => {
    treeElement.querySelectorAll<HTMLElement>('li[data-type="navigation-file"], li[data-type="navigation-root"]')
        .forEach(item => updateDocActionElement(treeElement, item));
};
