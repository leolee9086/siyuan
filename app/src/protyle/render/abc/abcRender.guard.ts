/**
 * abcRender.guard.ts - ABC 记谱渲染模块的类型守卫
 *
 * @module protyle/render/abcRender.guard
 */

import type { AbcRenderParams } from "../abcRender.types";

/**
 * 类型守卫：判断 looseJsonParse 返回值是否为有效的 ABC 渲染参数
 *
 * 作用：运行时验证解析结果包含必需的 responsive 字段
 * 意图：looseJsonParse 返回 unknown，需要安全窄化后才能使用
 * 调用时机：getAbcParams 解析用户参数后调用
 */
/** @同步豁免: 纯数据校验，无异步需求 */
export function isAbcRenderParams(value: unknown): value is AbcRenderParams {
    return typeof value === "object" && value !== null && "responsive" in value;
}
