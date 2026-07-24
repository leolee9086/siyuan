/**
 * 用途：表示文件树拖拽生命周期所需的完整宿主状态与行为。
 * 使用场景：拖拽注册、开始、悬停、放下和结束处理器共享同一上下文。
 * 关联类型：Files class 以结构化类型实现该契约，拖拽域不依赖其余文件树能力。
 */
export interface FilesDragContext {
    readonly element: HTMLElement;
    readonly parent: {
        readonly panelElement: HTMLElement;
    };
    refreshPublishAccessSwitch: () => void;
}
