/** 通用 Profile 接口，表示一个具有 ID、名称和数据的配置条目 */
export interface Profile<T = unknown> {
    id: string;
    name: string;
    data: T;
}

/** 命名空间状态接口，记录当前激活的 profile */
export interface NamespaceState {
    activeProfileId: string;
}

/**
 * /api/file/getFile 的响应类型
 * 可能返回：
 * - 文件内容（直接是 JSON 对象或字符串）
 * - 错误响应 { code: number, msg: string }
 */
export type GetFileResponse<T = unknown> = T | { code: number; msg: string } | string;
