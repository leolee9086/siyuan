/**
 * MAGI 界面层视图模型类型
 *
 * 用途：为 UI 提供独立于运行时内核实现的稳定展示类型。
 * 使用场景：MagiMainPanel/MagiRoot 等界面组件之间传递数据。
 */

/**
 * 通用消息视图
 */
export interface MagiMessageView {
    id: string;
    type: string;
    content: string;
    status: string;
    timestamp: number;
    meta?: Record<string, unknown>;
}

/**
 * 主面板消息视图
 */
export type MagiMainPanelMessageView = MagiMessageView;

/**
 * 主面板贤者连接视图
 */
export interface MagiMainPanelSeelView {
    config: {
        name: string;
        displayName: string;
    };
    loading: boolean;
    connected: boolean;
}

/**
 * 贤者面板消息视图
 */
export type MagiSeelPanelMessageView = MagiMessageView;

/**
 * 贤者面板视图
 */
export interface MagiSeelPanelView {
    config: {
        name: string;
        displayName?: string;
        color: string;
        icon: string;
        persona: string;
        responseType?: string;
        memorySize?: number;
        sseConfig?: { eventTypes?: string[] };
    };
    messages: MagiSeelPanelMessageView[];
    loading: boolean;
    connected: boolean;
}
