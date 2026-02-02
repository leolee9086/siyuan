/**
 * kernelSDK 客户端相关类型定义
 */

import type { ApiMethods } from "@leolee9086/siyuan-kernel-sdk";
import type { allApiDefs } from "./apiDefs";

/** 所有 API 定义的类型 */
export type AllApiDefs = typeof allApiDefs;

/**
 * kernelSDK 客户端实例类型
 *
 * 这个类型包含了所有可用的 API 方法，
 * 可以用于类型标注和 IDE 智能提示。
 */
export type KernelClientType = ApiMethods<AllApiDefs>;
