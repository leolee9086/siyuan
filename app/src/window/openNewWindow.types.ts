/**
 * 新窗口打开选项
 */
export interface WindowOptions {
    position?: {
        x: number,
        y: number,
    },
    width?: number,
    height?: number
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
