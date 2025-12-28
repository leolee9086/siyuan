/**
 * block 模块入口
 * 
 * 汇总所有块相关的 API 定义
 * 
 * 子模块:
 * - insert.ts: 插入块相关
 * - update.ts: 更新块相关  
 * - deleteAndMove.ts: 删除/移动块相关
 * - query.ts: 查询块信息相关 (TODO)
 * - ref.ts: 块引用相关 (TODO)
 * - heading.ts: 标题块相关 (TODO)
 */

import type { Api定义 } from '../../client/types';
import { insertApiDefs } from './insert';
import { updateApiDefs } from './update';
import { deleteAndMoveApiDefs } from './deleteAndMove';

// 导出所有子模块的 schema
export * from './schemas';

// 汇总所有 block API
export const blockApiDefs: readonly Api定义[] = [
    ...insertApiDefs,
    ...updateApiDefs,
    ...deleteAndMoveApiDefs,
    // TODO: 待迁移的 API 暂时需要从旧文件导入
    // ...queryApiDefs,
    // ...refApiDefs,
    // ...headingApiDefs,
];

// 也单独导出各子模块，方便按需导入
export { insertApiDefs } from './insert';
export { updateApiDefs } from './update';
export { deleteAndMoveApiDefs } from './deleteAndMove';
