/**
 * 窗口创建参数
 */
export interface WindowCreationParams {
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    alwaysOnTop?: boolean;
    url: string;
}

/**
 * 窗口创建函数类型
 * 用于解耦平台特定的窗口创建实现
 */
export type WindowCreator = (params: WindowCreationParams) => void;

/**
 * 新窗口打开选项
 */
export interface WindowOptions {
    position?: {
        x: number,
        y: number,
    },
    width?: number,
    height?: number,
    alwaysOnTop?: boolean,
    /**
     * 自定义窗口创建函数，用于替代默认的 IPC 实现
     * 如果不提供，将使用默认的 Electron IPC 通信
     */
    windowCreator?: WindowCreator;
}

/**
 * 资源标签页配置
 */
export interface AssetTabConfig {
    title: string;
    docIcon: string;
    pin: boolean;
    active: boolean;
    instance: "Tab";
    action: "Tab";
    children: {
        path: string;
        page: number;
        instance: "Asset";
    };
}
