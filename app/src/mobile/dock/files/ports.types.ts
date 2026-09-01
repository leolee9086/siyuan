/** 文件树列表接口返回的最小数据结构。 */
export interface MobileFilesListData {
    files: IFile[];
    box: string;
    path: string;
}

/** 提供 MobileFiles 主列表 DOM。 */
export interface MobileFilesElementPort {
    element: HTMLElement;
}

/** 提供关闭笔记本列表 DOM。 */
export interface MobileFilesClosedElementPort {
    closeElement: HTMLElement;
}

/** 提供文件树工具栏 DOM。 */
export interface MobileFilesActionsElementPort {
    actionsElement: HTMLElement;
}

/** 提供文件树初始化能力。 */
export interface MobileFilesInitPort {
    init(init?: boolean): void;
}

/** 提供文件树节点展开能力。 */
export interface MobileFilesLeafPort {
    getLeaf(liElement: Element, notebookId: string, focusUpdate?: boolean): void;
}

/** 提供文件树选中与路径展开能力。 */
export interface MobileFilesSelectionPort {
    setCurrent(target: HTMLElement, isScroll?: boolean): void;
    selectItem(
        notebookId: string,
        filePath: string,
        data?: MobileFilesListData,
        setStorage?: boolean,
        isSetCurrent?: boolean,
    ): Promise<HTMLElement | null | undefined>;
}

/** 提供展开路径持久化能力。 */
export interface MobileFilesPersistencePort {
    persistOpenPaths(): void;
}

/** 提供发布访问标记刷新能力。 */
export interface MobileFilesPublishAccessPort {
    refreshPublishAccessSwitch(): void;
}

/** 点击事件处理所需的文件树最小能力集合。 */
export interface MobileFilesEventPort extends MobileFilesElementPort, MobileFilesClosedElementPort,
    MobileFilesInitPort, MobileFilesLeafPort, MobileFilesSelectionPort, MobileFilesPersistencePort {
}

/** 文件列表渲染所需的最小能力集合。 */
export interface MobileFilesRenderPort extends MobileFilesElementPort, MobileFilesActionsElementPort,
    MobileFilesSelectionPort, MobileFilesPublishAccessPort {
    restoreMovedExpandedItems(listElement: Element, notebookId: string): void;
}

/** WebSocket DOM 更新所需的最小能力集合。 */
export interface MobileFilesWebSocketPort extends MobileFilesElementPort, MobileFilesClosedElementPort,
    MobileFilesLeafPort {
    recordMovedExpandedDocIDs(ids: Iterable<string>): void;
    restoreMovedExpandedItems(listElement: Element, notebookId: string): void;
    updateDocActionElement(liElement: HTMLElement): void;
    persistOpenPaths(): void;
}
