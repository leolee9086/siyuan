/** 用途：应用实例类型。使用范围：编辑器上下文参数。解耦评估：通过 ./imports 转发。 */
import { App } from "./imports";
/** 用途：Protyle 编辑器类型。使用范围：编辑器上下文参数。解耦评估：通过 ./imports 转发。 */
import { Protyle } from "./imports";

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
    /** 面板销毁后，异步块信息响应不得再创建编辑器。 */
    isDestroyed?: () => boolean;
}
