/** BlockPanel 管理编辑器所需的稳定结构，不依赖 Protyle class。 */
export interface IBlockPanelEditor {
    protyle: IProtyle;
    destroy: () => void;
}

/** BlockPanel 创建子编辑器的能力；具体 App 在面板装配闭包中绑定。 */
export type CreateBlockPanelEditor = (element: HTMLElement, options: IProtyleOptions) => IBlockPanelEditor;

/**
 * 初始化编辑器的上下文参数
 */
export interface EditorInitContext {
    createEditor: CreateBlockPanelEditor;
    refDefs: IRefDefs[];
    isBacklink: boolean;
    originalRefBlockIDs?: IObject | undefined;
    targetElement?: HTMLElement | undefined;
    x?: number | undefined;
    y?: number | undefined;
    editors: IBlockPanelEditor[];
    onFirstEditorReady?: () => void;
    /** 面板销毁后，异步块信息响应不得再创建编辑器。 */
    isDestroyed?: () => boolean;
}
