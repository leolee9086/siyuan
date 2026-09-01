/**
 * Layout 普通 Tab 打开能力的跨边界协议。
 *
 * 该协议与 Dialog 浮窗 Port 分开：普通 Tab 会进入布局树并参与布局序列化，
 * 宿主不得把请求实现为 Dialog 或搬移来源 Dock 的 DOM。
 */
/** 用途：抽象页签句柄；使用范围：普通 Tab 打开请求；解耦评估：不依赖 Tab class。 */
import type {ILayoutTabHandle} from "./tabFloat.types";

/** 未注册宿主时发出的稳定请求载荷，不携带 DOM 或具体模型实例。 */
export interface ILayoutTabOpenRequest {
    tabId: string;
    title: string;
    dockType: string;
    source: "agent-dock" | "dock-menu";
    /** 副本打开策略：复制当前会话（copy）或在标签页新建空白会话（new）。未指定时视为 copy。 */
    mode?: "copy" | "new";
}

/** 完整 App 或外部宿主提供的普通 Tab 能力。 */
export interface ILayoutTabOpenPort {
    /**
     * 打开来源模型的独立普通 Tab 副本。
     * mode 为 "new" 时宿主应创建空白会话副本而不是复制当前会话。
     * 返回 false 表示当前宿主没有处理该模型，调用方会继续发出类型化事件。
     */
    open: (tab: ILayoutTabHandle, source?: ILayoutTabOpenRequest["source"], mode?: ILayoutTabOpenRequest["mode"]) =>
        boolean | void | Promise<boolean | void>;
}
