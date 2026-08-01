/** 用途：布局模型抽象；使用范围：页签句柄的模型挂载能力；解耦评估：纯接口，不依赖具体 Model class。 */
import type {ILayoutModel} from "./lifecycle/model.types";

/** 页签副本流程实际使用的结构与能力，不依赖 Tab class。 */
export interface ILayoutTabHandle {
    id: string;
    title: string;
    icon: string;
    docIcon: string;
    headElement: HTMLElement;
    panelElement: HTMLElement;
    model: ILayoutModel | undefined;
    initialize: () => void;
    addModel: (model: ILayoutModel) => void;
}

/** 浮窗副本的统一生命周期句柄；宿主不需要知道具体模型类型。 */
export interface ILayoutTabFloatCopy {
    /** 关闭浮窗时释放模型、事件监听器、连接和编辑器资源。 */
    dispose: () => void;
    /** 可选：把模型内部的关闭动作接到当前 Dialog。 */
    setCloseHandler?: (handler: () => void) => void;
}

/**
 * Tab 浮窗副本工厂。
 *
 * 工厂在功能模块边界注册，布局宿主只依赖这个协议：
 * 先创建独立 Tab，再把它的 panel 挂到 Dialog，最后由工厂初始化模型。
 */
export interface ILayoutTabFloatFactory {
    /** 稳定的调试/替换标识，不能与其它工厂重复。 */
    id: string;
    /** 判断当前模型是否声明了该副本能力。 */
    canCreate: (tab: ILayoutTabHandle) => boolean;
    /** 创建独立 Tab，不得返回或复用源 Tab 的 DOM。 */
    createTab: (source: ILayoutTabHandle) => ILayoutTabHandle;
    /** 在目标 Tab 中初始化副本模型。 */
    create: (source: ILayoutTabHandle, target: ILayoutTabHandle) => ILayoutTabFloatCopy | Promise<ILayoutTabFloatCopy>;
}

/** 布局页签作为 Dialog 浮窗打开时的宿主能力；宿主必须创建副本，不得搬移原 Tab 的 DOM。 */
export interface ILayoutTabFloatPort {
    /**
     * 打开一个页签副本浮窗。
     * 返回 false 表示宿主没有处理该请求，调用方可继续走事件委托。
     */
    open: (tab: ILayoutTabHandle) => boolean | void | Promise<boolean | void>;
}

/** 未注册浮窗宿主时发出的类型化请求事件。 */
export interface ILayoutTabFloatRequest {
    tabId: string;
    title: string;
    source: "tab-menu";
}
