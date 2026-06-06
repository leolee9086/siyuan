/** 用途：应用类型定义。使用范围：Panel 相关类型依赖。解耦评估：通过目录网关导入可降低路径耦合。 */
import type { App } from "../index";

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
