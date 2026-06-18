/**
 * kernelSDK 模块入口
 * 
 * 导出共享的客户端实例和相关类型
 */

/** 导出 kernelClient 共享客户端实例，供 kernelSDK 用户直接使用 */
export { kernelClient } from "./client";
/** 导出 KernelClientType 客户端类型，供 kernelSDK 用户进行类型标注 */
export type { KernelClientType } from "./client.types";