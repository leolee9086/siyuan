/**
 * API 定义模块入口
 * 
 * 这个文件导出所有 API 定义，
 * 后续迁移时会逐个添加各分组的 API 定义。
 */

// 导出通用类型
export {
    标准响应Schema,
    创建响应Schema,
    createResponseSchema,
    BlockId,
    NotebookId,
    DocumentId,
    空请求Schema,
    EmptyRequestSchema,
} from './types';

export type { 标准响应 } from './types';

// TODO: 后续迁移时添加各分组 API 定义
// export { accountApiDefs } from './account';
// export { blockApiDefs } from './block';
// ...

/**
 * 所有 API 定义的合并 (待实现)
 *
 * @example
 * ```typescript
 * const allApiDefs = [...accountApiDefs, ...blockApiDefs] as const;
 * ```
 */
// export const allApiDefs = [] as const;
