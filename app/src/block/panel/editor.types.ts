/** 用途：数据库条目定位请求；使用范围：编辑器加载完成上下文；解耦评估：稳定请求类型，不依赖定位实现。 */
import type {IAVLocateRequest} from "../../protyle/render/av/locate/locate.types";

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
    locateAttributeView: (protyle: IProtyle, blockID: string, request: IAVLocateRequest) => void;
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

/** 块信息响应进入编辑器构造阶段所需的完整异步上下文。 */
export interface IBlockInfoResponseContext {
    response: IWebSocketData;
    editorElement: HTMLElement;
    refDef: IRefDefs;
    ctx: EditorInitContext;
    afterCB?: () => void;
}

/** Protyle 完成加载后的收尾上下文。 */
export interface IEditorLoadedContext {
    editor: IBlockPanelEditor;
    rootID: string;
    refDef: IRefDefs;
    locateAttributeView: EditorInitContext["locateAttributeView"];
    afterCB?: () => void;
}
