/**
 * MAGI 界面层视图模型类型
 *
 * 用途：为 UI 提供独立于运行时内核实现的稳定展示类型。
 * 使用场景：MagiRoot、SeelPanel 与 Trinity Monitor 之间传递数据。
 */

/** 用途：连接状态类型定义。使用范围：MAGI 界面视图模型状态管理。解耦评估：通过 composables 目录导入，保持类型与逻辑分离。 */
import type { ConnectionStatus } from "../composables/useMagi.types";

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
 * 主面板贤者连接视图
 */
export interface MagiSeelConnectionView {
    config: {
        name: string;
        displayName: string;
    };
    loading: boolean;
    connected: boolean;
    connectionStatus: ConnectionStatus;
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
    connectionStatus: ConnectionStatus;
}
