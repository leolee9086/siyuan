/** 用途：浮窗 Port 需要接收稳定的 Tab 句柄；使用范围：菜单请求和完整 App Dialog 适配器；解耦评估：仅保留 type-only 依赖，运行时由 Port/事件承载，避免能力接口直接实例化或导入具体 Tab 实现。 */
import type {Tab} from "./Tab";

/** 布局页签作为 Dialog 浮窗打开时的宿主能力；宿主必须创建副本，不得搬移原 Tab 的 DOM。 */
export interface ILayoutTabFloatPort {
    /**
     * 打开一个页签副本浮窗。
     * 返回 false 表示宿主没有处理该请求，调用方可继续走事件委托。
     */
    open: (tab: Tab) => boolean | void | Promise<boolean | void>;
}

/** 未注册浮窗宿主时发出的类型化请求事件。 */
export interface ILayoutTabFloatRequest {
    tabId: string;
    title: string;
    source: "tab-menu";
}
