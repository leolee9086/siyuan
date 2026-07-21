/**
 * 用途：表示 MAGI Vue 宿主持有的 Agent Panel 异步运行时句柄。
 * 使用场景：组件等待面板就绪，并在卸载时同步释放面板、事件监听和晚到实例。
 * 关联类型：内部管理 `AgentPanelHandle`，但不向 Vue 宿主暴露面板实现细节。
 */
export interface MagiAgentPanelHostRuntime {
    /** 面板完成引导和挂载后兑现；初始化错误会原样向宿主传播。 */
    ready: Promise<void>;
    /** 幂等释放事件监听和已创建或稍后到达的面板实例。 */
    destroy: () => void;
}

/**
 * 用途：保存 MAGI Agent Panel 宿主初始化和销毁所需的可变状态。
 * 使用场景：模块级生命周期函数通过显式参数共享状态，避免闭包和类。
 * 关联类型：由工厂创建，并通过 `MagiAgentPanelHostRuntime` 向宿主暴露最小句柄。
 */
export interface MagiAgentPanelHostRuntimeState {
    /** Agent Panel 要挂载到的宿主元素。 */
    target: HTMLElement;
    /** 已完成挂载的面板句柄。 */
    panel: AgentPanelHandle | null;
    /** 宿主是否已经进入销毁状态。 */
    disposed: boolean;
    /** 初始化期间收到的最后一条头像草稿。 */
    pendingDraft: string;
    /** 已绑定状态参数的窗口事件监听器。 */
    writeAvatarListener?: EventListener;
}
/** 用途：约束运行时持有的面板句柄；使用范围：MAGI 宿主内部状态；解耦评估：经同目录网关获取纯类型，不暴露控制器实现。 */
import type {AgentPanelHandle} from "./imports";
