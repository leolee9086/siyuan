/**
 * 笔记内插件类型定义
 */
/**
 * 笔记内插件配置
 */
export interface 笔记内插件配置 {
    /** 文档ID */
    docId: string;
    /** 插件名称（自动生成：in-note-<docId>） */
    name: string;
    /** 显示名称（文档标题） */
    displayName: string;
    /** 是否启用 */
    enabled: boolean;
    /** 上次加载时间 */
    lastLoadAt: number;
    /** 上次错误信息 */
    lastError: string | null;
}

/**
 * 笔记内插件运行状态
 */
export interface 笔记内插件运行状态<TPlugin> {
    /** 配置信息 */
    config: 笔记内插件配置;
    /** 插件实例 */
    instance: TPlugin | null;
    /** 运行状态 */
    status: "idle" | "loading" | "running" | "error";
    /** 模块清理函数 */
    cleanup?: () => void;
}

/**
 * 编译后的模块信息
 */
export interface 编译结果 {
    /** 编译后的代码 */
    code: string;
    /** 是否有错误 */
    hasError: boolean;
    /** 错误信息 */
    error?: string;
}
