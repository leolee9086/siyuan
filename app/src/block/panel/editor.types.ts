/** 用途：数据库条目定位请求；使用范围：编辑器加载完成上下文；解耦评估：稳定请求类型，不依赖定位实现。 */
import type {IAVLocateRequest} from "../../protyle/render/av/locate/locate.types";
/** 用途：BlockPanel 子编辑器完整领域根；使用范围：创建、观察、销毁和加载回调。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 用途：完整 AV 根渲染能力；使用范围：定位激活组合上下文；解耦评估：纯类型依赖稳定领域签名。 */
import type {AVRenderer} from "../../protyle/render/av/view/render.types";
/** 用途：完整 AV 定位激活上下文；使用范围：定位实现签名；解耦评估：纯类型直达领域声明。 */
import type {AVLocateActivationContext} from "../../protyle/render/av/locate/locate.types";

/** BlockPanel 创建 Protyle 时使用的完整选项，仅将加载回调绑定到抽象领域身份。 */
export type BlockPanelEditorOptions =
    Omit<IProtyleOptions, "after"> & {after: (editor: ProtyleDomain) => void};

/** BlockPanel 创建子编辑器的能力；具体 App 在面板装配闭包中绑定。 */
export type CreateBlockPanelEditor = (element: HTMLElement, options: BlockPanelEditorOptions) => ProtyleDomain;

/**
 * 初始化编辑器的上下文参数
 */
export interface EditorInitContext {
    createEditor: CreateBlockPanelEditor;
    locateAttributeView: (context: AVLocateActivationContext, request: IAVLocateRequest) => void;
    renderAttributeView: AVRenderer;
    refDefs: IRefDefs[];
    isBacklink: boolean;
    originalRefBlockIDs?: IObject | undefined;
    targetElement?: HTMLElement | undefined;
    x?: number | undefined;
    y?: number | undefined;
    editors: ProtyleDomain[];
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
    editor: ProtyleDomain;
    rootID: string;
    refDef: IRefDefs;
    locateAttributeView: EditorInitContext["locateAttributeView"];
    renderAttributeView: AVRenderer;
    afterCB?: () => void;
    /** 首次渲染完成后执行一次的面板定位收尾。 */
    onInitialRender?: () => void;
}
