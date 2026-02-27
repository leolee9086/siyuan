/**
 * abcRender.types.ts - ABC 记谱渲染模块的类型定义
 *
 * @module protyle/render/abcRender.types
 */

/**
 * ABC 记谱渲染参数类型
 *
 * abcjs renderAbc 的 options 参数，用户可通过 %%params 首行自定义
 */
export interface AbcRenderParams {
    responsive: string;
    [key: string]: unknown;
}
