import { App } from "../../index";
import { Protyle } from "../../protyle";

/**
 * 初始化编辑器的上下文参数
 */
export interface EditorInitContext {
    app: App;
    refDefs: IRefDefs[];
    isBacklink: boolean;
    originalRefBlockIDs?: IObject | undefined;
    targetElement?: HTMLElement | undefined;
    x?: number | undefined;
    y?: number | undefined;
    editors: Protyle[];
    onFirstEditorReady?: () => void;
}
