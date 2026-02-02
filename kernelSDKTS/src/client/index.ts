/**
 * 客户端模块入口
 */
export { 创建客户端, createClient } from './factory';
export type {
    客户端配置,
    ClientOptions,
    Api定义,
    ApiDef,
    推断请求类型,
    InferRequest,
    推断响应类型,
    InferResponse,
    Api方法映射,
    ApiMethods,
    同步Api方法映射,
    SyncApiMethods,
    完整客户端,
    FullClient,
} from './types';
