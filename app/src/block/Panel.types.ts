import { App } from "../index";

/**
 * 执行图标操作的参数
 */
export interface headIconCtx {
    type: string | null;
    target: HTMLElement;
    element: HTMLElement;
    refDefs: IRefDefs[];
    app: App;
    onDestroy: () => void;
}
