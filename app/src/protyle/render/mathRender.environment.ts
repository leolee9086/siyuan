/**
 * mathRender.environment.ts - 数学公式渲染模块的 window 访问封装
 *
 * 封装 mathRender 所需的全局对象访问（window.katex、window.siyuan.config），
 * 避免在业务代码中直接访问 window 全局对象。
 *
 * @module protyle/render/mathRender.environment
 */

/**
 * 获取 KaTeX 渲染器实例
 *
 * 作用：提供对动态加载的 window.katex 对象的访问
 * 意图：封装 window 全局对象访问，符合架构规范
 * 调用时机：KaTeX 脚本加载完成后，渲染数学公式前调用
 *
 * @returns KaTeX 渲染器对象
 */
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 */
export function getKatexRenderer() {
    return window.katex;
}

/**
 * 获取用户配置的 KaTeX 宏定义字符串
 *
 * 作用：从 siyuan 配置中读取 katexMacros
 * 意图：封装 window.siyuan.config 访问，避免直接访问全局对象
 * 调用时机：渲染数学公式前，需要获取用户自定义宏时调用
 *
 * @returns katexMacros 字符串，如果配置不存在则返回空字符串
 */
/** @同步豁免: 遗留代码 - 读取已加载的配置对象，无异步需求 */
export function getKatexMacrosString() {
    return window.siyuan?.config?.editor?.katexMacros || "";
}
