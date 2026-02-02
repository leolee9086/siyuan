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
export type {
    客户端配置,
    ClientOptions,
    Api定义,
    ApiMethods,
    Api方法映射,
    客户端配置属性,
    同步Api方法映射,
    SyncApiMethods,
    完整客户端,
    FullClient,
    // 响应处理相关类型
    响应处理方式,
    ResponseHandler,
    请求配置,
    RequestOptions,
    // 条件类型 - 根据 responseHandler 推断返回类型
    ResponseByHandler,
    根据处理器推断响应,
    SyncResponseByHandler,
    根据处理器推断同步响应,
    // 原始响应类型
    AsyncRawResponse,
    异步原始响应,
} from './client/types';

// 导出同步请求工具
export {
    syncFetch,
    同步请求,
    SyncFetchError,
    同步请求错误,
    type SyncFetchOptions,
    type 同步请求配置选项,
    type SyncRawResponse,
    type 同步原始响应,
} from './utils/syncFetch';

// 导出所有 API 定义
export * from './apiDefs/index';
