/** 用途：描述历史快照文档预览所需的编辑器组合参数。使用范围：repoFile 将已确认的文档快照交给独立渲染 helper。解耦评估：AppFacade 仅暴露编辑器创建契约，不加载具体应用或编辑器类。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 用途：描述历史快照预览回调接收的编辑器领域表面。使用范围：预览创建后由历史面板保存或销毁。解耦评估：仅类型依赖，不加载 Protyle 实现。 */
import type {ProtyleDomain} from "../protyle/protyle.types";

/** 历史文档点击流程所需的完整宿主上下文。 */
export interface IHistoryDocClickContext<TEditor, TDialog> {
    readonly target: HTMLElement;
    readonly type: string | null;
    readonly event: MouseEvent;
    readonly element: HTMLElement;
    readonly firstPanelElement: HTMLElement;
    readonly historyEditor: TEditor;
    readonly dialog: TDialog | undefined;
    readonly clearHistoryEditor: () => void;
}

/** 历史仓库快照列表项。使用场景：比较、桌面和移动端历史文件列表渲染。关联类型：由 repoFile 的列表项渲染 helper 消费。 */
export interface IHistoryRepoFile {
    fileID: string;
    indexID: string;
    title: string;
    hPath?: string;
    hSize: string;
    updated: number;
}

/** 历史快照文档预览的完整组合输入。 */
export type TRepoFileDocumentRenderRequest = {
    app: AppFacade,
    contentElement: Element,
    snapshotId: string,
    response: IWebSocketData,
    onEditor?: (editor: ProtyleDomain) => void,
};

/** 历史快照文件打开请求的完整组合输入。 */
export type TRepoFileRenderRequest = {
    app: AppFacade,
    element: Element,
    contentElement: Element,
    onEditor?: (editor: ProtyleDomain) => void,
};

/** 历史快照响应处理所需的稳定请求上下文。 */
export type TRepoFileResponseRequest = Omit<TRepoFileRenderRequest, "element"> & {
    snapshotId: string,
    requestId: string,
};
