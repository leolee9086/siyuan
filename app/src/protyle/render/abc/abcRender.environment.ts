/**
 * abcRender.environment.ts - ABC 记谱渲染模块的 window 访问封装
 *
 * 封装 abcRender 所需的全局对象访问（window.ABCJS），
 * 避免在业务代码中直接访问 window 全局对象。
 *
 * @module protyle/render/abcRender.environment
 */

/**
 * 获取 ABCJS 库实例
 *
 * 作用：提供对动态加载的 window.ABCJS 对象的访问
 * 意图：封装 window 全局对象访问，符合架构规范
 * 调用时机：ABCJS 脚本加载完成后调用
 *
 * @returns ABCJS 库对象
 */
/** @同步豁免: 遗留代码 - 访问动态加载到 window 上的第三方库对象 @显式返回类型原因: Window['ABCJS'] 是从全局 window 上读取的动态加载库类型，显式标注方便调用方直接使用 ABCJS 类型的方法和属性，无需重复类型断言。 */
export function getAbcjsInstance(): Window["ABCJS"] {
    return window.ABCJS;
}
