/**
 * block 模块入口
 *
 * 汇总所有块相关的 API 定义
 *
 * 子模块:
 * - insert.ts: 插入块相关 (8 个 API)
 * - update.ts: 更新块相关 (2 个 API)
 * - deleteAndMove.ts: 删除/移动/折叠块相关 (5 个 API)
 * - query.ts: 查询块信息相关 (22 个 API)
 * - ref.ts: 块引用相关 (8 个 API)
 * - heading.ts: 标题块相关 (6 个 API)
 * - misc.ts: 其他 (1 个 API)
 */

import type { Api定义 } from '../../client/types';
import { insertApiDefs, type InsertApiDefs } from './insert';
import { updateApiDefs, type UpdateApiDefs } from './update';
import { deleteAndMoveApiDefs, type DeleteAndMoveApiDefs } from './deleteAndMove';
import { queryApiDefs, type QueryApiDefs } from './query';
import { refApiDefs, type RefApiDefs } from './ref';
import { headingApiDefs, type HeadingApiDefs } from './heading';
import { miscApiDefs, type MiscApiDefs } from './misc';

// 导出所有子模块的 schema
export * from './schemas';

// 汇总所有 block API（运行时使用）
export const blockApiDefs: readonly Api定义[] = [
    ...insertApiDefs,
    ...updateApiDefs,
    ...deleteAndMoveApiDefs,
    ...queryApiDefs,
    ...refApiDefs,
    ...headingApiDefs,
    ...miscApiDefs,
];

/**
 * Block API 定义的联合类型
 * 用于类型推断，保留字面量类型信息
 */
export type BlockApiDefs = readonly [
    ...InsertApiDefs,
    ...UpdateApiDefs,
    ...DeleteAndMoveApiDefs,
    ...QueryApiDefs,
    ...RefApiDefs,
    ...HeadingApiDefs,
    ...MiscApiDefs,
];

// 也单独导出各子模块，方便按需导入
export { insertApiDefs } from './insert';
export { updateApiDefs } from './update';
export { deleteAndMoveApiDefs } from './deleteAndMove';
export { queryApiDefs } from './query';
export { refApiDefs } from './ref';
export { headingApiDefs } from './heading';
export { miscApiDefs } from './misc';

// 导出子模块类型
export type { InsertApiDefs } from './insert';
export type { UpdateApiDefs } from './update';
export type { DeleteAndMoveApiDefs } from './deleteAndMove';
export type { QueryApiDefs } from './query';
export type { RefApiDefs } from './ref';
export type { HeadingApiDefs } from './heading';
export type { MiscApiDefs } from './misc';
