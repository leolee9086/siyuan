/**
 * @siyuan/kernel-sdk
 * 类型安全的思源笔记内核 API 客户端
 * 
 * @example
 * ```typescript
 * import { 创建客户端 } from '@siyuan/kernel-sdk';
 * import { accountApiDefs } from '@siyuan/kernel-sdk/apiDefs';
 * 
 * const client = 创建客户端(accountApiDefs, {
 *   baseUrl: 'http://127.0.0.1:6806',
 *   apiToken: 'your-token',
 * });
 * 
 * const result = await client.login({ ... });
 * ```
 */

// 导出客户端工厂和类型工具
export { 创建客户端, createClient } from './client/factory';
export type { 客户端配置, ClientOptions, Api定义 } from './client/types';

// 导出所有 API 定义
export * from './apiDefs/index';
