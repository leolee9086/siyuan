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
import { insertApiDefs } from './insert';
import { updateApiDefs } from './update';
import { deleteAndMoveApiDefs } from './deleteAndMove';
import { queryApiDefs } from './query';
import { refApiDefs } from './ref';
import { headingApiDefs } from './heading';
import { miscApiDefs } from './misc';

// 导出所有子模块的 schema
export * from './schemas';

// 汇总所有 block API
export const blockApiDefs: readonly Api定义[] = [
    ...insertApiDefs,
    ...updateApiDefs,
    ...deleteAndMoveApiDefs,
    ...queryApiDefs,
    ...refApiDefs,
    ...headingApiDefs,
    ...miscApiDefs,
];

// 也单独导出各子模块，方便按需导入
export { insertApiDefs } from './insert';
export { updateApiDefs } from './update';
export { deleteAndMoveApiDefs } from './deleteAndMove';
export { queryApiDefs } from './query';
export { refApiDefs } from './ref';
export { headingApiDefs } from './heading';
export { miscApiDefs } from './misc';
