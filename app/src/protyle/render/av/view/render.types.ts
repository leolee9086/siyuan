/** 已取得服务端数据后的 AV 视图渲染请求，由根调度器在 table、gallery 与 kanban 间分派。 */
export interface AVViewRenderRequest {
    blockElement: HTMLElement;
    protyle: IProtyle;
    cb: ((data: IAV) => void) | undefined;
    renderAll: boolean;
    data: IAV;
}

/** AV 子视图请求根调度器渲染已解析数据的统一能力。 */
export type AVViewRenderer = (request: AVViewRenderRequest) => Promise<void>;
