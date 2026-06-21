export interface IMoveContext {
    protyle: IProtyle;
    doOperations: IOperation[];
    undoOperations: IOperation[];
    tempTargetElement: Element;
    targetId: string;
    isSameLi: boolean;
    newListId: string;
    newListElement?: Element;
    isCopy: boolean;
    isSameDoc: boolean;
    position: InsertPosition;
    newSourceElements: Element[];
    copyFoldHeadingIds: { newId: string, oldId: string }[];
    sourcePositions: Map<string, { previousID: string; parentID: string }>;
}
