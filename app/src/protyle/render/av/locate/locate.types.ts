/** 用途：完整 AV 根渲染签名；使用范围：定位激活上下文；解耦评估：纯类型直达领域声明。 */
import type {AVRenderer} from "../view/render.types";

/** 数据库条目定位请求；由调用方声明目标身份、视觉反馈和视图持久化策略。 */
export interface IAVLocateRequest {
    itemID: string;
    groupID?: string;
    viewID?: string;
    select?: boolean;
    highlight?: boolean;
    persistView?: boolean;
    previousViewID?: string;
    messageShown?: boolean;
}

/** 等待文档渲染后激活的完整定位项。 */
export interface AVQueuedLocateRequest {
    request: IAVLocateRequest;
    timer: number;
    activationToken?: symbol;
}

/** 单条排队定位重试链的完整隔离状态。 */
export interface AVQueuedLocateRetryState {
    queued: AVQueuedLocateRequest;
    timeout: number;
    activationToken: symbol;
}

/** 已显示定位高亮的完整生命周期。 */
export interface AVLocateHighlightState {
    element: HTMLElement;
    className: string;
    timer: number;
}

/** AV 定位在导航、渲染和视觉完成阶段共享的完整注册状态。 */
export interface AVLocateRegistryState {
    locateRequests: WeakMap<HTMLElement, IAVLocateRequest>;
    queuedLocateRequests: Map<string, AVQueuedLocateRequest>;
    renderTokens: WeakMap<HTMLElement, symbol>;
    renderedAVData: WeakMap<HTMLElement, IAV>;
    highlightTokens: WeakMap<HTMLElement, symbol>;
    highlightStates: WeakMap<HTMLElement, AVLocateHighlightState>;
    activeHighlights: Set<AVLocateHighlightState>;
}

/** 一次 AV 定位激活所需的完整根渲染与编辑器身份。 */
export interface AVLocateActivationContext {
    renderAV: AVRenderer;
    protyle: IProtyle;
    blockID: string;
}

/** 一次 AV 定位完成呈现所需的完整 DOM、编辑器、数据与请求身份。 */
export interface AVLocatePresentationContext {
    blockElement: HTMLElement;
    protyle: IProtyle;
    data: IAV;
    request: IAVLocateRequest;
}

/** 单次 requestAnimationFrame 高亮呈现的完整隔离输入。 */
export interface AVLocateHighlightFrame {
    context: AVLocatePresentationContext;
    groupQuery: string;
    token: symbol;
}
